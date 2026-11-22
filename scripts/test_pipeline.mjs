import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const FFMPEG_PATH = 'C:\\Users\\mskar\\AppData\\Local\\ms-playwright\\ffmpeg-1011\\ffmpeg-win64.exe';
const MARKETING_DIR = 'C:\\Users\\mskar\\captodesk\\public\\marketing';
const MASTER_AUDIO = path.join(MARKETING_DIR, 'v3_master_audio.mp3');
const OUTPUT_VIDEO = path.join(MARKETING_DIR, 'captodesk_reel_driveway_payments.mp4');

console.log('Testing video rendering pipeline...');
console.log('Audio file exists:', fs.existsSync(MASTER_AUDIO));
