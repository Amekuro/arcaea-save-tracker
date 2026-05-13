import os
import json
import shutil
from pathlib import Path

def extract_assets():
    base_dir = Path(__file__).resolve().parent.parent
    apk_dir = base_dir / 'arcaea_6.14.1c'
    songs_dir = apk_dir / 'assets' / 'songs'
    
    public_dir = base_dir / 'public'
    public_songs_dir = public_dir / 'songs'
    
    if not songs_dir.exists():
        print(f"Error: {songs_dir} does not exist.")
        return

    # Create public/songs directory
    public_songs_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Copy and parse songlist
    songlist_file = songs_dir / 'songlist'
    if not songlist_file.exists():
        print("Error: songlist file not found.")
        return
        
    with open(songlist_file, 'r', encoding='utf-8') as f:
        try:
            songlist_data = json.load(f)
        except json.JSONDecodeError:
            print("Error parsing songlist.")
            return

    # Extract basic song info
    extracted_songs = []
    for song in songlist_data.get('songs', []):
        song_id = song.get('id')
        title = song.get('title_localized', {}).get('en', song_id)
        
        # Determine the difficulties present
        difficulties = [d.get('ratingClass') for d in song.get('difficulties', [])]
        
        extracted_songs.append({
            'id': song_id,
            'title': title,
            'difficulties': difficulties
        })
        
        # 2. Copy jacket images
        # Usually they are base.jpg (Past/Present/Future), 3.jpg (Beyond), 4.jpg (Eternal)
        # Sometimes there's 0.jpg, 1.jpg, 2.jpg for specific difficulty jackets.
        song_folder = songs_dir / song_id
        if song_folder.exists() and song_folder.is_dir():
            target_song_folder = public_songs_dir / song_id
            target_song_folder.mkdir(parents=True, exist_ok=True)
            
            for img_name in ['base.jpg', 'base_256.jpg', '0.jpg', '1.jpg', '2.jpg', '3.jpg', '4.jpg']:
                src_img = song_folder / img_name
                if src_img.exists():
                    shutil.copy2(src_img, target_song_folder / img_name)
                    
    # Save a simplified songlist to public/ for frontend to use
    with open(public_dir / 'songlist.json', 'w', encoding='utf-8') as f:
        json.dump(extracted_songs, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully extracted {len(extracted_songs)} songs and their jacket images to {public_dir}")

if __name__ == '__main__':
    extract_assets()
