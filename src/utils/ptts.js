import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { parseSongMetadata } from './songDataParser.js'

/**
 * 核心逻辑：解析 Arcaea st3 (SQLite) 文件并计算 PTT
 * @param {ArrayBuffer} fileBuffer st3 文件的二进制数据
 * @param {Array} songlistData 从本地 public/songlist.json 获取的歌曲映射表
 * @param {Array} packlistData 从本地 public/packlist.json 获取的曲包映射表
 * @param {Object} constantsData 从 wiki 获取的曲目定数表 ChartConstant.json
 * @returns {Object} 包含计算完成的 b30 列表、所有成绩列表及 b30 平均值
 */
export async function parseSt3(fileBuffer, songlistData, packlistData, constantsData) {
  // 1. 初始化 sql.js。使用 Vite 的 ?url 显式导入 wasm 路径，避免路径和 MIME 类型错误
  const SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl
  });
  
  // 2. 加载数据库
  const db = new SQL.Database(new Uint8Array(fileBuffer));
  
  // 3. 严谨的表结构校验：确保目标文件真的是 Arcaea 的存档库
  const checkTables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('scores', 'cleartypes')");
  // 如果连最基本的表结构都没有（查出来的表数量不足 2），直接抛出异常
  if (!checkTables.length || !checkTables[0].values || checkTables[0].values.length < 2) {
    db.close();
    throw new Error("数据库格式错误：未找到 Arcaea 存档必备的 'scores' 或 'cleartypes' 数据表。");
  }
  
  // 4. 执行 SQL 查询获取玩家所有分数
  // 使用 LEFT JOIN 关联 cleartypes 表，获取每个成绩对应的最高 Clear Type
  const query = `
    SELECT 
      s.id,
      s.songId, 
      s.songDifficulty, 
      s.score,
      s.shinyPerfectCount,
      s.perfectCount,
      s.nearCount,
      s.missCount,
      s.date,
      c.clearType
    FROM scores s
    LEFT JOIN cleartypes c 
      ON s.songId = c.songId 
      AND s.songDifficulty = c.songDifficulty
  `;
  
  const res = db.exec(query);
  if (!res.length) {
    db.close();
    throw new Error("在存档中未找到分数记录 (scores table is empty or invalid)");
  }
  
  const columns = res[0].columns;
  const values = res[0].values;
  
  // 将二维数组结果转换为对象数组
  const records = values.map(row => {
    const record = {};
    columns.forEach((col, i) => { record[col] = row[i]; });
    return record;
  });
  
  // 4. 根据定数表计算每首歌的单曲 PTT (Play Rating)
  const results = [];
  const diffNames = ['Past', 'Present', 'Future', 'Beyond', 'Eternal'];

  for (const record of records) {
    const { songId, songDifficulty, score } = record;
    
    // 寻找定数数据
    const diffConstants = constantsData[songId];
    // 如果找不到该曲目或者对应难度没有定数（可能定数表未更新），跳过计算
    if (!diffConstants || !diffConstants[songDifficulty]) continue; 
    
    const constantObj = diffConstants[songDifficulty];
    const constant = constantObj.constant;
    
    // Arcaea 单曲 PTT 计算公式 参考："https://wiki.arcaea.cn/潜力值"
    let ptt = 0;
    if (score >= 10000000) {
      ptt = constant + 2.0;
    } else if (score >= 9800000) {
      ptt = constant + 1.0 + (score - 9800000) / 200000;
    } else {
      ptt = constant + (score - 9500000) / 300000;
      if (ptt < 0) ptt = 0; // PTT 不会跌到 0 以下
    }
    
    // 寻找该首歌曲在 songlist 中的元数据
    const songInfo = songlistData.find(s => s.id === songId);
    
    // 使用抽离出来的解析器统一处理多语言、多难度覆盖以及展平搜索数组
    const metadata = parseSongMetadata(songInfo, songId, songDifficulty, packlistData);
    
    // 解析 Clear Type
    const clearTypeLabels = ['Track Lost', 'Normal Clear', 'Full Recall', 'Pure Memory', 'Easy Clear', 'Hard Clear'];
    const clearTypeLabel = clearTypeLabels[record.clearType] || 'Unknown';
    
    // 格式化日期
    let playDate = '早期记录/未知';
    if (record.date > 1000000000) {
      const d = new Date(record.date * 1000);
      playDate = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    
    results.push({
      ...record,
      ...metadata, // 注入由 songDataParser 计算出来的各语言数据和曲包信息
      difficultyName: diffNames[songDifficulty] || 'Unknown',
      clearTypeLabel,
      playDate,
      constant,
      ptt
    });
  }
  
  // 5. 将结果按单曲 PTT 从高到低排序，以此来计算 Rank 和 Best 30
  results.sort((a, b) => b.ptt - a.ptt);
  
  // 为所有成绩分配排名
  results.forEach((record, index) => {
    record.rank = index + 1;
  });
  
  // 6. 截取前 30 首作为 Best 30
  const b30 = results.slice(0, 30);
  
  // 计算 b30 平均值
  const b30Avg = b30.length > 0 
    ? b30.reduce((acc, cur) => acc + cur.ptt, 0) / 30 
    : 0;
    
  // 计算理论最高 PTT (Max PTT): (B30 总和 + B30 前 10 首总和) / 40
  // 如果 B30 数量不足 10 首，则使用实际长度
  const top10 = b30.slice(0, 10);
  const b30Sum = b30.reduce((acc, cur) => acc + cur.ptt, 0);
  const top10Sum = top10.reduce((acc, cur) => acc + cur.ptt, 0);
  const maxPtt = b30.length > 0 ? (b30Sum + top10Sum) / 40 : 0;
  
  // 7. 恢复按数据库 ID 排序（即默认先后顺序）
  results.sort((a, b) => a.id - b.id);
  
  db.close();
  
  return {
    allRecords: results,
    b30,
    b30Avg,
    maxPtt
  };
}
