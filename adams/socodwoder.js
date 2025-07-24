const { adams } = require('../Ibrahim/adams');
const axios = require('axios');
const fs = require('fs-extra');
const { mediafireDl } = require("../Ibrahim/Function");
const conf = require(__dirname + "/../config");
const ffmpeg = require("fluent-ffmpeg");
const gis = require('g-i-s');
const ytSearch = require("yt-search");

// API key for giftedtech API
const GIFTED_API_KEY = "gifted";

// Helper function to extract response from various API formats
function extractResponse(data) {
    const possibleFields = [
        'download_url', 'url_abu', 'hd_video', 'video_url', 'audio_url', 'link',
        'downloadUrl', 'alternativeUrl', 'HD', 'hd', 'withoutwatermark', 
        'noWatermark', 'result', 'response', 'BK9', 'message', 'data', 
        'video', 'audio', 'video_no_watermark', 'nwm'
    ];
    
    for (const field of possibleFields) {
        if (data[field]) {
            if (typeof data[field] === 'object') {
                return extractResponse(data[field]); // Recursively check nested objects
            }
            return data[field];
        }
    }
    return data; // Return the entire response if no known field found
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
    mediafire: {
        name: "Mediafire",
        url: (url) => `https://api.giftedtech.co.ke/api/download/mediafire?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`
    },
    googledrive: {
        name: "Google Drive",
        url: (url) => `https://api.giftedtech.co.ke/api/download/gdrivedl?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`
    },
    github: {
        name: "GitHub",
        url: (url) => `https://api.giftedtech.co.ke/api/download/gitclone?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`
    },
    pastebin: {
        name: "Pastebin",
        url: (url) => `https://api.giftedtech.co.ke/api/download/pastebin?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`
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
        } else if (url.includes('mediafire.com')) {
            platform = API_ENDPOINTS.mediafire;
        } else if (url.includes('drive.google.com')) {
            platform = API_ENDPOINTS.googledrive;
        } else if (url.includes('github.com')) {
            platform = API_ENDPOINTS.github;
        } else if (url.includes('pastebin.com')) {
            platform = API_ENDPOINTS.pastebin;
        } else if (url.includes('open.spotify.com')) {
            platform = API_ENDPOINTS.spotify;
        } else {
            return repondre(`Unsupported platform. Supported: ${Object.values(API_ENDPOINTS).map(p => p.name).join(', ')}`);
        }

        const apiUrl = platform.url(url);
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            validateStatus: function (status) {
                return status < 500; // Reject only if status code is >= 500
            }
        });

        // Handle various API response formats
        const responseData = response.data || {};
        const downloadUrl = extractResponse(responseData);

        if (!downloadUrl) {
            return repondre(`No downloadable content found from ${platform.name}`);
        }

        // Determine content type
        const isVideo = downloadUrl.includes('.mp4') || downloadUrl.includes('.mov') || downloadUrl.includes('.webm');
        const isAudio = downloadUrl.includes('.mp3') || downloadUrl.includes('.m4a') || downloadUrl.includes('.ogg');
        const isImage = downloadUrl.includes('.jpg') || downloadUrl.includes('.png') || downloadUrl.includes('.webp');

        // Send appropriate media type
        if (isVideo) {
            await zk.sendMessage(dest, {
                video: { url: downloadUrl },
                caption: `Downloaded from ${platform.name} by BWM XMD`,
                gifPlayback: false
            }, { quoted: ms });
        } else if (isAudio) {
            await zk.sendMessage(dest, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${platform.name.toLowerCase()}_audio.mp3`,
                caption: `Downloaded from ${platform.name} by BWM XMD`
            }, { quoted: ms });
        } else if (isImage) {
            await zk.sendMessage(dest, {
                image: { url: downloadUrl },
                caption: `Downloaded from ${platform.name} by BWM XMD`
            }, { quoted: ms });
        } else {
            // Default to document for unknown types
            await zk.sendMessage(dest, {
                document: { url: downloadUrl },
                fileName: `downloaded_from_${platform.name.toLowerCase()}`,
                caption: `Downloaded from ${platform.name} by BWM XMD`
            }, { quoted: ms });
        }

    } catch (error) {
        console.error('Download error:', error);
        
        let errorMessage = 'Failed to download content';
        if (error.response) {
            // Handle HTTP errors
            if (error.response.status === 400) {
                errorMessage = 'Invalid URL or request format';
            } else if (error.response.status === 404) {
                errorMessage = 'Content not found';
            } else if (error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            }
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Request timed out. Please try again.';
        }
        
        repondre(`❌ ${errorMessage}`);
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
        const audioUrl = extractResponse(response.data);
        
        if (!audioUrl) throw new Error('No audio URL found in response');

        await zk.sendMessage(dest, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: 'youtube_audio.mp3',
            caption: 'YouTube audio downloaded by BWM XMD'
        }, { quoted: ms });

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
        const videoUrl = extractResponse(response.data);
        
        if (!videoUrl) throw new Error('No video URL found in response');

        await zk.sendMessage(dest, {
            video: { url: videoUrl },
            caption: 'YouTube video downloaded by BWM XMD'
        }, { quoted: ms });

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
        const videoUrl = extractResponse(response.data);
        
        if (!videoUrl) throw new Error('No video URL found in response');

        await zk.sendMessage(dest, {
            video: { url: videoUrl },
            caption: 'TikTok video (no watermark) downloaded by BWM XMD'
        }, { quoted: ms });

    } catch (error) {
        console.error('TikTok download error:', error);
        repondre('❌ Failed to download TikTok video. Please check the URL and try again.');
    }
});

// APK Downloader
adams({
    nomCom: "apk",
    aliases: ["apkdl"],
    desc: "Download APK files",
    categorie: "Download"
}, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    const packageName = arg.join(' ');

    if (!packageName) return repondre('Please provide an app package name (e.g. com.whatsapp) or app name (e.g. WhatsApp)');

    try {
        const response = await axios.get(`https://api.giftedtech.co.ke/api/download/apkdl?apikey=${GIFTED_API_KEY}&appName=${encodeURIComponent(packageName)}`, {
            timeout: 20000 // Longer timeout for APK downloads
        });

        const responseData = response.data || {};
        const apkUrl = extractResponse(responseData);
        const appName = responseData.name || packageName || 'app';

        if (!apkUrl) {
            return repondre('APK not found for the specified package');
        }

        await zk.sendMessage(dest, {
            document: { url: apkUrl },
            mimetype: 'application/vnd.android.package-archive',
            fileName: `${appName.replace(/\s+/g, '_')}.apk`,
            caption: `${appName} APK - Downloaded by BWM XMD`
        }, { quoted: ms });

    } catch (error) {
        console.error('APK download error:', error);
        repondre('❌ Failed to download APK. Please check the package name and try again.');
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
        const audioUrl = extractResponse(response.data);
        
        if (!audioUrl) throw new Error('No audio URL found in response');

        await zk.sendMessage(dest, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: 'spotify_track.mp3',
            caption: 'Spotify track downloaded by BWM XMD'
        }, { quoted: ms });

    } catch (error) {
        console.error('Spotify download error:', error);
        repondre('❌ Failed to download Spotify track. Please check the URL and try again.');
    }
});
