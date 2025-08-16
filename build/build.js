#!/usr/bin/env node

/**
 * Build script for the entire doc-via-doxygen project
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Building doc-via-doxygen project...\n');

function runCommand(command, cwd = process.cwd()) {
    console.log(`📂 Running: ${command} in ${cwd}`);
    try {
        execSync(command, { cwd, stdio: 'inherit' });
        console.log('✅ Success\n');
    } catch (error) {
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
    }
}

// Ensure dist directories exist
const projectRoot = process.cwd();
ensureDir(path.join(projectRoot, 'dist', 'pipeline-task'));
ensureDir(path.join(projectRoot, 'dist', 'code-hub'));
ensureDir(path.join(projectRoot, 'dist', 'extension'));

// Build pipeline-task
console.log('🔨 Building pipeline-task...');
const pipelineTaskDir = path.join(projectRoot, 'src', 'pipeline-task');
runCommand('npm run build', pipelineTaskDir);

// Copy pipeline-task build artifacts
console.log('📦 Copying pipeline-task artifacts...');
const pipelineTaskDist = path.join(pipelineTaskDir, 'dist');
const targetPipelineTaskDist = path.join(projectRoot, 'dist', 'pipeline-task');

if (fs.existsSync(pipelineTaskDist)) {
    runCommand(`xcopy "${pipelineTaskDist}\\*" "${targetPipelineTaskDist}\\" /E /Y /I`, projectRoot);
}

// Build code-hub (placeholder)
console.log('🔨 Building code-hub...');
console.log('ℹ️  Code Hub build not implemented yet\n');

// Build extension
console.log('🔨 Building extension...');
console.log('ℹ️  Extension build will be implemented after components are ready\n');

console.log('🎉 Build completed successfully!');
console.log('📁 Output directory: ./dist/');