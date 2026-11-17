const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(backendDir, '..');
const frontendDir = path.join(rootDir, 'frontend');
const frontendDistDir = path.join(frontendDir, 'dist');
const backendPublicDir = path.join(backendDir, 'public');

const shouldBuildIfAvailable = process.argv.includes('--build-if-available');

if (shouldBuildIfAvailable && fs.existsSync(path.join(frontendDir, 'package.json'))) {
    console.log('🔨 Building frontend bundle for unified deployment...');
    execSync('npm install --include=dev --no-audit --no-fund', { cwd: frontendDir, stdio: 'inherit' });
    execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });
}

if (fs.existsSync(path.join(frontendDistDir, 'index.html'))) {
    fs.rmSync(backendPublicDir, { recursive: true, force: true });
    fs.cpSync(frontendDistDir, backendPublicDir, { recursive: true });
    console.log(`✅ Synced frontend build -> ${backendPublicDir}`);
} else if (fs.existsSync(path.join(backendPublicDir, 'index.html'))) {
    console.log(`ℹ️ Using pre-bundled frontend build in ${backendPublicDir}`);
} else {
    console.warn('⚠️ No frontend build found (frontend/dist or backend/public). API-only mode.');
}

// Ensure NKD-CRM.apk is always present in backend/public
const sourceApk = [
    path.join(rootDir, 'NKD-CRM.apk'),
    path.join(backendDir, 'NKD-CRM.apk'),
    path.join(frontendDir, 'public', 'NKD-CRM.apk')
].find(p => fs.existsSync(p));

if (sourceApk) {
    const targetApk = path.join(backendPublicDir, 'NKD-CRM.apk');
    if (!fs.existsSync(targetApk)) {
        fs.copyFileSync(sourceApk, targetApk);
        console.log(`📱 Synced APK -> ${targetApk}`);
    }
}

