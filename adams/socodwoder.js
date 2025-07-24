const { adams } = require('../Ibrahim/adams');
const axios = require('axios');
const fs = require('fs-extra');
const { mediafireDl } = require("../Ibrahim/Function");
const conf = require(__dirname + "/../config");
const ffmpeg = require("fluent-ffmpeg");
const gis = require('g-i-s');
const ytSearch = require("yt-search");

// API key for giftedtech API
const GIFTED_API_KEY = "gifted_api_6kuv56877d";

// Helper function to extract response from various API formats
function extractResponse(data) {
    const possibleFields = [
        'download_url', 'noWatermark', 'hd_video', 'video_url', 'audio_url', 'link_url',
        'downloadUrl', 'alternativeUrl', 'HD', 'hd', 'withoutwatermark', 
        'result', 'response', 'BK9', 'message', 'data', 'video', 'audio'
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
        let apiUrl;
        if (url.includes('twitter.com') || url.includes('x.com')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/twitter?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else if (url.includes('tiktok.com')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/tiktokdlv2?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else if (url.includes('instagram.com')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/instadl?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/ytdlv2?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else if (url.includes('facebook.com')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/facebook?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else if (url.includes('pinterest.com') || url.includes('pin.it')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/pinterestdl?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else if (url.includes('mediafire.com')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/mediafire?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else if (url.includes('drive.google.com')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/gdrivedl?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else if (url.includes('github.com')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/gitclone?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else if (url.includes('pastebin.com')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/pastebin?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else if (url.includes('open.spotify.com')) {
            apiUrl = `https://api.giftedtech.co.ke/api/download/spotifydl?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`;
        } else {
            return repondre('Unsupported platform. Supported: Twitter, TikTok, Instagram, YouTube, Facebook, Pinterest, Mediafire, Google Drive, GitHub, Pastebin, Spotify');
        }

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
            return repondre('No downloadable content found in the response');
        }

        // Determine content type
        const isVideo = downloadUrl.includes('.mp4') || downloadUrl.includes('.mov') || downloadUrl.includes('.webm');
        const isAudio = downloadUrl.includes('.mp3') || downloadUrl.includes('.m4a') || downloadUrl.includes('.ogg');
        const isImage = downloadUrl.includes('.jpg') || downloadUrl.includes('.png') || downloadUrl.includes('.webp');

        // Send appropriate media type
        if (isVideo) {
            await zk.sendMessage(dest, {
                video: { url: downloadUrl },
                caption: 'Downloaded by BWM XMD',
                gifPlayback: false
            }, { quoted: ms });
        } else if (isAudio) {
            await zk.sendMessage(dest, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: 'downloaded_audio.mp3'
            }, { quoted: ms });
        } else if (isImage) {
            await zk.sendMessage(dest, {
                image: { url: downloadUrl },
                caption: 'Downloaded by BWM XMD'
            }, { quoted: ms });
        } else {
            // Default to document for unknown types
            await zk.sendMessage(dest, {
                document: { url: downloadUrl },
                fileName: 'downloaded_file'
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
        const response = await axios.get(`https://api.giftedtech.co.ke/api/download/ytdlv2?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(url)}`);
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

// Ringtone Downloader
adams({
    nomCom: "ringtone",
    aliases: ["rtone"],
    desc: "Download ringtones",
    categorie: "Download"
}, async (dest, zk, commandeOptions) => {
    const { ms, repondre, arg } = commandeOptions;
    const query = arg.join(' ');

    if (!query) return repondre('Please provide a search term (e.g. Quran)');

    try {
        // Using YouTube search as fallback since the API doesn't have a specific ringtone endpoint
        const searchResults = await ytSearch(query);
        const video = searchResults.videos[0];
        if (!video) throw new Error('No results found');
        
        const response = await axios.get(`https://api.giftedtech.co.ke/api/download/ytdlv2?apikey=${GIFTED_API_KEY}&url=${encodeURIComponent(video.url)}`);
        const audioUrl = extractResponse(response.data);
        
        if (!audioUrl) throw new Error('No audio URL found in response');

        await zk.sendMessage(dest, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: 'ringtone.mp3',
            caption: `Ringtone: ${video.title} - Downloaded by BWM XMD`
        }, { quoted: ms });

    } catch (error) {
        console.error('Ringtone download error:', error);
        repondre('❌ Failed to download ringtone. Please try a different search term.');
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

    
