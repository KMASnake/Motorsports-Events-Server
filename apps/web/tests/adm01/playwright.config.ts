import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 testDir:'.',testMatch:'*.pw.ts',workers:1,outputDir:'/tmp/adm01/browser-results',reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:3417',viewport:{width:1440,height:900},browserName:'chromium'},
 webServer:{command:'npm run dev --workspace @mse/web -- --host 127.0.0.1 --port 3417',cwd:fileURLToPath(new URL('../../../../',import.meta.url)),env:{VITE_API_URL:''},url:'http://127.0.0.1:3417',reuseExistingServer:false}
});
