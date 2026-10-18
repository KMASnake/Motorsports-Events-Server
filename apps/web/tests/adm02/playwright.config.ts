import {defineConfig} from '@playwright/test';
import existing from '../adm01/playwright.config';
export default defineConfig({...existing,testDir:'..',testMatch:['**/adm01/*.pw.ts','**/adm02/*.pw.ts'],outputDir:'/tmp/adm02-implementation/browser-results'});
