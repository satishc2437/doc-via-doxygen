import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TaskInputs {
    sourceDirectory: string;
    outputDirectory: string;
    projectName: string;
    projectVersion?: string;
    sourceFilePattern: string;
    useCustomDoxyFile: boolean;
    customDoxyFilePath?: string;
}

export class DoxygenTask {
    private inputs: TaskInputs;

    constructor() {
        this.inputs = this.getInputs();
    }

    private getInputs(): TaskInputs {
        return {
            sourceDirectory: tl.getPathInput('sourceDirectory', true) || process.cwd(),
            outputDirectory: tl.getPathInput('outputDirectory', true) || path.join(process.cwd(), 'docs'),
            projectName: tl.getInput('ProjectName', true) || 'My Project',
            projectVersion: tl.getInput('ProjectVersion', false) || '1.0',
            sourceFilePattern: tl.getInput('SourceFilePattern', true) || '*.c *.cpp *.h *.hpp',
            useCustomDoxyFile: tl.getBoolInput('UseCustomDoxyFile', true),
            customDoxyFilePath: tl.getPathInput('CustomDoxyFilePath', false)
        };
    }

    public async checkDoxygenInstallation(): Promise<boolean> {
        try {
            await execAsync('doxygen --version');
            console.log('Doxygen found and available');
            return true;
        } catch (error) {
            console.error('Doxygen not found in PATH');
            return false;
        }
    }

    public async validateInputs(): Promise<void> {
        // Check if Doxygen is installed
        const doxygenAvailable = await this.checkDoxygenInstallation();
        if (!doxygenAvailable) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('DoxygenNotFound'));
            return;
        }

        // Check if custom config file exists (if using custom config)
        if (this.inputs.useCustomDoxyFile && this.inputs.customDoxyFilePath) {
            const configPath = path.resolve(this.inputs.sourceDirectory, this.inputs.customDoxyFilePath);
            if (!await fs.pathExists(configPath)) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('ConfigFileNotFound', configPath));
                return;
            }
        }

        // Validate that custom doxyfile path is provided when useCustomDoxyFile is true
        if (this.inputs.useCustomDoxyFile && !this.inputs.customDoxyFilePath) {
            tl.setResult(tl.TaskResult.Failed, 'Custom Doxyfile path is required when using custom configuration file option');
            return;
        }

        // Ensure output directory exists
        await fs.ensureDir(this.inputs.outputDirectory);
    }

    public async generateDocumentation(): Promise<void> {
        try {
            console.log(`Generating documentation for project: ${this.inputs.projectName}`);
            console.log(`Project version: ${this.inputs.projectVersion}`);
            console.log(`Source directory: ${this.inputs.sourceDirectory}`);
            console.log(`Output directory: ${this.inputs.outputDirectory}`);
            console.log(`Source file pattern: ${this.inputs.sourceFilePattern}`);

            // Change to source directory for Doxygen execution
            const originalCwd = process.cwd();
            process.chdir(this.inputs.sourceDirectory);

            let configContent: string;
            let tempConfigPath: string;

            if (this.inputs.useCustomDoxyFile && this.inputs.customDoxyFilePath) {
                // Use custom Doxyfile
                console.log(`Using custom Doxyfile: ${this.inputs.customDoxyFilePath}`);
                const configPath = path.resolve(this.inputs.customDoxyFilePath);
                configContent = await fs.readFile(configPath, 'utf8');

                // Modify OUTPUT_DIRECTORY in the custom config to ensure it points to our output directory
                configContent = configContent.replace(
                    /^OUTPUT_DIRECTORY\s*=.*$/m,
                    `OUTPUT_DIRECTORY = ${this.inputs.outputDirectory}`
                );
            } else {
                // Generate automatic Doxyfile
                console.log('Generating automatic Doxygen configuration...');
                configContent = this.generateAutoDoxyfile();
            }

            tempConfigPath = path.join(process.cwd(), 'Doxyfile.tmp');
            await fs.writeFile(tempConfigPath, configContent);

            // Run Doxygen
            const { stdout, stderr } = await execAsync(`doxygen "${tempConfigPath}"`);

            if (stdout) {
                console.log('Doxygen output:', stdout);
            }
            if (stderr) {
                console.warn('Doxygen warnings:', stderr);
            }

            // Clean up temporary config
            await fs.remove(tempConfigPath);

            // Restore original working directory
            process.chdir(originalCwd);

            console.log(tl.loc('DocumentationGenerated', this.inputs.outputDirectory));

        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, `Failed to generate documentation: ${error}`);
            throw error;
        }
    }

    public generateAutoDoxyfile(): string {
        return `# Auto-generated Doxygen configuration file
# Generated by Azure DevOps Doc via Doxygen task

# Project information
PROJECT_NAME           = "${this.inputs.projectName}"
PROJECT_NUMBER         = "${this.inputs.projectVersion || '1.0'}"
PROJECT_BRIEF          = "Documentation for ${this.inputs.projectName}"

# Input settings
INPUT                  = ${this.inputs.sourceDirectory}
RECURSIVE              = YES
FILE_PATTERNS          = ${this.inputs.sourceFilePattern}

# Output settings
OUTPUT_DIRECTORY       = ${this.inputs.outputDirectory}
GENERATE_HTML          = YES
GENERATE_LATEX         = NO
HTML_OUTPUT            = html

# Documentation extraction settings
EXTRACT_ALL            = YES
EXTRACT_PRIVATE        = YES
EXTRACT_STATIC         = YES
EXTRACT_LOCAL_CLASSES  = YES

# Source browsing
SOURCE_BROWSER         = YES
INLINE_SOURCES         = YES

# Preprocessing
ENABLE_PREPROCESSING   = YES
MACRO_EXPANSION        = YES
EXPAND_ONLY_PREDEF     = NO

# Dot tool (for diagrams)
HAVE_DOT               = NO
CLASS_DIAGRAMS         = YES

# Other settings
GENERATE_TREEVIEW      = YES
DISABLE_INDEX          = NO
FULL_SIDEBAR           = NO
HTML_COLORSTYLE_HUE    = 220
HTML_COLORSTYLE_SAT    = 100
HTML_COLORSTYLE_GAMMA  = 80

# Include subdirectories
RECURSIVE              = YES

# Optimize for different programming languages
OPTIMIZE_OUTPUT_FOR_C  = YES
OPTIMIZE_OUTPUT_JAVA   = YES

# Include documentation for undocumented members
EXTRACT_ALL            = YES
`;
    }

    public async publishArtifacts(): Promise<void> {
        try {
            const artifactName = 'documentation';
            console.log(tl.loc('PublishingArtifacts', artifactName));

            // Use Azure Pipelines task library to publish artifacts
            tl.uploadArtifact(
                artifactName,
                this.inputs.outputDirectory,
                artifactName
            );

            console.log(`Documentation artifacts published successfully as: ${artifactName}`);
        } catch (error) {
            console.warn(`Failed to publish artifacts: ${error}`);
        }
    }

    public async run(): Promise<void> {
        try {
            console.log('Starting Doxygen documentation generation task...');

            await this.validateInputs();
            await this.generateDocumentation();
            await this.publishArtifacts();

            console.log('Documentation generation task completed successfully');
            tl.setResult(tl.TaskResult.Succeeded, 'Documentation generated successfully');

        } catch (error) {
            console.error(`Task failed: ${error}`);
            tl.setResult(tl.TaskResult.Failed, `Task failed: ${error}`);
        }
    }
}

// Main execution
async function main(): Promise<void> {
    const task = new DoxygenTask();
    await task.run();
}

// Export for testing
export { main };

// Run the task automatically (Azure DevOps compatible)
// Use environment variable to prevent execution during testing
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
    main().catch((error) => {
        console.error('Unhandled error:', error);
        tl.setResult(tl.TaskResult.Failed, `Unhandled error: ${error}`);
    });
}