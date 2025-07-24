const { adams } = require('../Ibrahim/adams');
const axios = require('axios');

// API key for giftedtech API
const GIFTED_API_KEY = "gifted";

// Enhanced function to extract video and audio URLs from response
function extractMedia(data) {
    const result = {
        videos: [],
        audios: []
    };

    // List of possible video fields to check
    const videoFields = [
        'download_url', 'url', 'hd_video', 'video_url', 
        'video_no_watermark', 'nwm', 'videoWithWatermark',
        'videoWithoutWatermark', 'video_hd', 'video_sd',
        'video', 'link', 'downloadUrl'
    ];

    // List of possible audio fields to check
    const audioFields = [
        'audio_url', 'audio', 'download_url', 'url',
        'link', 'downloadUrl'
    ];

    // Recursive function to scan the object
    function scanObject(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;

        // Check all possible video fields
        for (const field of videoFields) {
            if (obj[field] && typeof obj[field] === 'string') {
                // Check if URL looks like a video (may not have extension)
                if (obj[field].match(/\.(mp4|mov|webm)$/i) || 
                   obj[field].match(/video|mp4|mov|webm/i)) {
                    if (!result.videos.includes(obj[field])) {
                        result.videos.push(obj[field]);
                    }
                }
            }
        }

        // Check all possible audio fields
        for (const field of audioFields) {
            if (obj[field] && typeof obj[field] === 'string') {
                // Check if URL looks like audio (may not have extension)
                if (obj[field].match(/\.(mp3|m4a|ogg)$/i) || 
                   obj[field].match(/audio|mp3|m4a|ogg/i)) {
                    if (!result.audios.includes(obj[field])) {
                        result.audios.push(obj[field]);
                    }
                }
            }
        }

        // Recursively scan all properties
        for (const key in obj) {
            if (typeof obj[key] === 'object') {
                scanObject(obj[key], `${path}.${key}`);
            } else if (typeof obj[key] === 'string' && key.toLowerCase().includes('url')) {
                // Check any URL field that might contain media
                if (obj[key].match(/\.(mp4|mov|webm)$/i)) {
                    if (!result.videos.includes(obj[key])) {
                        result.videos.push(obj[key]);
                    }
                } else if (obj[key].match(/\.(mp3|m4a|ogg)$/i)) {
                    if (!result.audios.includes(obj[key])) {
                        result.audios.push(obj[key]);
                    }
                }
            }
        }
    }

    scanObject(data);
    return result;
}

// Platform-specific API endpoints
const API_ENDPOINTS = {
    twitter: {
        name: "Twitter",
        url: (url) => `https://api.giftedtech.co.ke/api/download/twitter?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`
    },
    tiktok: {
        name: "TikTok",
        url: (url) => `https://api.giftedtech.co.ke/api/download/tiktok?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}&noWatermark=true`
    },
    instagram: {
        name: "Instagram",
        url: (url) => `https://api.giftedtech.co.ke/api/download/instadl?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`
    },
    youtube: {
        name: "YouTube",
        url: (url) => `https://api.giftedtech.co.ke/api/download/ytdlv2?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`
    },
    facebook: {
        name: "Facebook",
        url: (url) => `https://api.giftedtech.co.ke/api/download/facebook?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`
    },
    pinterest: {
        name: "Pinterest",
        url: (url) => `https://api.giftedtech.co.ke/api/download/pinterestdl?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`
    },
    spotify: {
        name: "Spotify",
        url: (url) => `https://api.giftedtech.co.ke/api/download/spotifydl?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`
    }
};

// Generic Downloader Command
adams({
    nomCom: "download",
    aliases: ["dl"],
    desc: "Download content from various platforms",
    categorie: "Download"
}, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    const url = arg.join(' ');

    if (!url) return repondre('Please provide a valid URL');

    try {
        // Detect platform and select appropriate endpoint
        let platform;
        if (url.includes('twitter.com') || url.includes('x.com')) {
            platform = API_ENDPOINTS.twitter;
        } else if (url.includes('tiktok.com')) {
            platform = API_ENDPOINTS.tiktok;
        } else if (url.includes('instagram.com')) {
            platform = API_ENDPOINTS.instagram;
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            platform = API_ENDPOINTS.youtube;
        } else if (url.includes('facebook.com')) {
            platform = API_ENDPOINTS.facebook;
        } else if (url.includes('pinterest.com') || url.includes('pin.it')) {
            platform = API_ENDPOINTS.pinterest;
        } else if (url.includes('open.spotify.com')) {
            platform = API_ENDPOINTS.spotify;
        } else {
            return repondre(`Unsupported platform. Supported: ${Object.values(API_ENDPOINTS).map(p => p.name).join(', ')}`);
        }

        const apiUrl = platform.url(url);
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            validateStatus: function (status) {
                return status < 500;
            }
        });

        // Extract media from response
        const media = extractMedia(response.data || {});

        // Debug: Log the response and extracted media
        console.log('API Response:', response.data);
        console.log('Extracted Media:', media);

        // Send all available media
        if (media.videos.length > 0 || media.audios.length > 0) {
            // Send videos first
            for (const videoUrl of media.videos) {
                try {
                    await zk.sendMessage(dest, {
                        video: { url: videoUrl },
                        caption: `Downloaded from ${platform.name} by BWM XMD`,
                        gifPlayback: false
                    }, { quoted: ms });
                } catch (videoError) {
                    console.error('Error sending video:', videoError);
                }
            }

            // Then send audios
            for (const audioUrl of media.audios) {
                try {
                    await zk.sendMessage(dest, {
                        audio: { url: audioUrl },
                        mimetype: 'audio/mpeg',
                        fileName: `${platform.name.toLowerCase()}_audio.mp3`,
                        caption: `Downloaded from ${platform.name} by BWM XMD`
                    }, { quoted: ms });
                } catch (audioError) {
                    console.error('Error sending audio:', audioError);
                }
            }
        } else {
            // If no media found, show the API response for debugging
            console.log('Full API Response:', response.data);
            return repondre(`❌ No video or audio found in the response from ${platform.name}. Please try another URL.`);
        }

    } catch (error) {
        console.error('Download error:', error);
        repondre('❌ Failed to download content. Please check the URL and try again.');
    }
});

// YouTube MP3 Downloader
adams({
    nomCom: "ytmp3",
    aliases: ["ytaudio"],
    desc: "Download YouTube audio as MP3",
    categorie: "Download"
}, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    const url = arg.join(' ');

    if (!url) return repondre('Please provide a YouTube URL');

    try {
        const response = await axios.get(`https://api.giftedtech.co.ke/api/download/ytdlv2?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}&type=mp3`);
        const media = extractMedia(response.data || {});
        
        if (media.audios.length === 0) {
            throw new Error('No audio URL found in response');
        }

        // Send all audio files found
        for (const audioUrl of media.audios) {
            await zk.sendMessage(dest, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                fileName: 'youtube_audio.mp3',
                caption: 'YouTube audio downloaded by BWM XMD'
            }, { quoted: ms });
        }

    } catch (error) {
        console.error('YouTube MP3 download error:', error);
        repondre('❌ Failed to download YouTube audio. Please check the URL and try again.');
    }
});

// YouTube Video Downloader
adams({
    nomCom: "ytmp4",
    aliases: ["ytvideo"],
    desc: "Download YouTube videos",
    categorie: "Download"
}, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    const url = arg.join(' ');

    if (!url) return repondre('Please provide a YouTube URL');

    try {
        const response = await axios.get(`https://api.giftedtech.co.ke/api/download/ytdlv2?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`);
        const media = extractMedia(response.data || {});
        
        if (media.videos.length === 0) {
            throw new Error('No video URL found in response');
        }

        // Send all video files found
        for (const videoUrl of media.videos) {
            await zk.sendMessage(dest, {
                video: { url: videoUrl },
                caption: 'YouTube video downloaded by BWM XMD'
            }, { quoted: ms });
        }

    } catch (error) {
        console.error('YouTube video download error:', error);
        repondre('❌ Failed to download YouTube video. Please check the URL and try again.');
    }
});

// TikTok Downloader (with no watermark)
adams({
    nomCom: "tiktok",
    aliases: ["ttdl"],
    desc: "Download TikTok videos without watermark",
    categorie: "Download"
}, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    const url = arg.join(' ');

    if (!url) return repondre('Please provide a TikTok URL');

    try {
        const response = await axios.get(`https://api.giftedtech.co.ke/api/download/tiktok?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}&noWatermark=true`);
        const media = extractMedia(response.data || {});
        
        if (media.videos.length === 0) {
            throw new Error('No video URL found in response');
        }

        // Send all video files found
        for (const videoUrl of media.videos) {
            await zk.sendMessage(dest, {
                video: { url: videoUrl },
                caption: 'TikTok video (no watermark) downloaded by BWM XMD'
            }, { quoted: ms });
        }

    } catch (error) {
        console.error('TikTok download error:', error);
        repondre('❌ Failed to download TikTok video. Please check the URL and try again.');
    }
});

// Spotify Downloader
adams({
    nomCom: "spotify",
    aliases: ["spotifydl"],
    desc: "Download Spotify tracks",
    categorie: "Download"
}, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    const url = arg.join(' ');

    if (!url) return repondre('Please provide a Spotify track URL');

    try {
        const response = await axios.get(`https://api.giftedtech.co.ke/api/download/spotifydl?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`);
        const media = extractMedia(response.data || {});
        
        if (media.audios.length === 0) {
            throw new Error('No audio URL found in response');
        }

        // Send all audio files found
        for (const audioUrl of media.audios) {
            await zk.sendMessage(dest, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                fileName: 'spotify_track.mp3',
                caption: 'Spotify track downloaded by BWM XMD'
            }, { quoted: ms });
        }

    } catch (error) {
        console.error('Spotify download error:', error);
        repondre('❌ Failed to download Spotify track. Please check the URL and try again.');
    }
});
