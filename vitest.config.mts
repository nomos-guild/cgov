import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},test:{include:['test/cip179-*.spec.ts'],maxWorkers:1,minWorkers:1,testTimeout:15000}});
