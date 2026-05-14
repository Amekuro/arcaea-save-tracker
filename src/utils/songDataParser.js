/**
 * 解析和格式化 Arcaea 歌曲的各种多语言文本和难度信息
 * 解决了官方 json 数据结构层级复杂、存在多难度覆盖等问题
 */

export function parseSongMetadata(songInfo, songId, songDifficulty, packlistData) {
  // --- 1. 获取对应难度的专属信息 (用于处理例如 PRAGMATISM -RESURRECTION- 等特殊曲目) ---
  const diffInfo = songInfo?.difficulties ? songInfo.difficulties.find(d => d.ratingClass === songDifficulty) : null;

  // --- 2. 合并和提取多语言 Title ---
  // 如果当前难度有专属的 title_localized (如愚人节/Beyond)，则覆盖基础曲名
  let title_localized = { en: songInfo?.title || songId };
  if (songInfo?.title_localized) {
    title_localized = { ...songInfo.title_localized };
  }
  if (diffInfo && diffInfo.title_localized) {
    title_localized = { ...title_localized, ...diffInfo.title_localized };
  }

  // --- 3. 合并和提取多语言 Artist ---
  let artist_localized = { en: songInfo?.artist || 'Unknown Artist' };
  if (songInfo?.artist_localized) {
    artist_localized = { ...songInfo.artist_localized };
  }
  if (diffInfo && diffInfo.artist_localized) {
    artist_localized = { ...artist_localized, ...diffInfo.artist_localized };
  }

  // --- 4. 展平 search_title 和 search_artist (官方 json 中它们是形如 { "ja": ["str1", "str2"] } 的对象) ---
  const flattenSearchObj = (searchObj) => {
    if (!searchObj) return [];
    let result = [];
    Object.values(searchObj).forEach(arr => {
      if (Array.isArray(arr)) {
        result.push(...arr);
      } else if (typeof arr === 'string') {
        result.push(arr);
      }
    });
    return result;
  };

  const search_title = flattenSearchObj(songInfo?.search_title);
  const search_artist = flattenSearchObj(songInfo?.search_artist);

  // 如果专属难度也有 search 覆盖（理论上很少见，但为了防范于未然）
  if (diffInfo?.search_title) {
    search_title.push(...flattenSearchObj(diffInfo.search_title));
  }
  if (diffInfo?.search_artist) {
    search_artist.push(...flattenSearchObj(diffInfo.search_artist));
  }

  // --- 5. 曲绘覆盖 (Jacket) ---
  let jacketPath = 'base.avif';
  if (diffInfo && diffInfo.jacketOverride) {
    jacketPath = `${songDifficulty}.avif`;
  }

  // --- 6. 难度等级 (Rating) ---
  let ratingLevelStr = 'Unknown';
  if (diffInfo) {
    ratingLevelStr = diffInfo.ratingPlus ? `${diffInfo.rating}+` : `${diffInfo.rating}`;
  }

  // --- 7. 曲包信息 (Pack) 和排序权重 ---
  let packName = 'Unknown Pack';
  let packOrder = 9999;
  
  if (songInfo && songInfo.set) {
    if (songInfo.set === 'single') {
      packName = 'Memory Archive';
      packOrder = -1; // 单曲包通常置顶
    } else {
      const packIndex = packlistData.findIndex(p => p.id === songInfo.set);
      packOrder = packIndex >= 0 ? packIndex : 9999;
      
      const packInfo = packlistData[packIndex];
      if (packInfo) {
        packName = packInfo.name_localized?.['zh-Hans'] || packInfo.name_localized?.['zh-Hant'] || packInfo.name_localized?.ja || packInfo.name_localized?.en || songInfo.set;
      } else {
        packName = songInfo.set;
      }
    }
  }

  return {
    title_localized,
    artist_localized,
    search_title,
    search_artist,
    jacketPath,
    ratingLevelStr,
    packName,
    packOrder
  };
}
