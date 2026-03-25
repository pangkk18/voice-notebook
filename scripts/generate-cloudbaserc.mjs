import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envPath = path.join(root, '.env.local');
const templatePath = path.join(root, 'cloudbaserc.template.json');
const outputPath = path.join(root, 'cloudbaserc.json');

if (!fs.existsSync(envPath)) {
  throw new Error('.env.local not found');
}

if (!fs.existsSync(templatePath)) {
  throw new Error('cloudbaserc.template.json not found');
}

const envContent = fs.readFileSync(envPath, 'utf8');
const templateContent = fs.readFileSync(templatePath, 'utf8');
const match = envContent.match(/^VITE_CLOUDBASE_ENV_ID=(.+)$/m);
const envId = match?.[1]?.trim();

if (!envId || envId === '<your-cloudbase-env-id>') {
  throw new Error('VITE_CLOUDBASE_ENV_ID is missing or still placeholder in .env.local');
}

const rendered = templateContent.replace(/<your-cloudbase-env-id>/g, envId);
fs.writeFileSync(outputPath, `${rendered.trim()}\n`, 'utf8');

console.log(`Generated ${path.relative(root, outputPath)} for env ${envId}`);
