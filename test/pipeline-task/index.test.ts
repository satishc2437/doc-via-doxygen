/// <reference types="jest" />

// Jest mocks must be at the top level and hoisted
jest.mock('azure-pipelines-task-lib/task', () => ({
    getPathInput: jest.fn(),
    getBoolInput: jest.fn(),
    getInput: jest.fn(),
    setResult: jest.fn(),
    TaskResult: {
        Failed: 1,
        Succeeded: 0
    },
    loc: jest.fn((key, ...args) => `${key}: ${args.join(', ')}`),
    uploadArtifact: jest.fn()
}));

// Mock fs-extra with explicit type safety
const mockFsExtra = {
    pathExists: jest.fn(),
    ensureDir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    remove: jest.fn()
};

jest.mock('fs-extra', () => mockFsExtra);

const mockExecAsync = jest.fn();
jest.mock('util', () => ({
    promisify: () => mockExecAsync
}));

// NOW import the module under test
import { DoxygenTask } from '../../src/pipeline-task/src/index';
import * as tl from 'azure-pipelines-task-lib/task';

// Get the mocked modules for use in tests
const mockedTl = tl as jest.Mocked<typeof tl>;
const mockedFs = mockFsExtra;

describe('DoxygenTask', () => {
    let doxygenTask: DoxygenTask;

    beforeEach(() => {
        jest.clearAllMocks();

        // Set up default mock return values
        mockedTl.getPathInput.mockImplementation((name: string) => {
            switch (name) {
                case 'sourceDirectory': return '/test/source';
                case 'outputDirectory': return '/test/output';
                case 'CustomDoxyFilePath': return '/test/custom/doxyfile';
                default: return undefined;
            }
        });

        mockedTl.getInput.mockImplementation((name: string) => {
            switch (name) {
                case 'ProjectName': return 'Test Project';
                case 'ProjectVersion': return '1.0.0';
                case 'SourceFilePattern': return '*.cpp *.h';
                default: return undefined;
            }
        });

        mockedTl.getBoolInput.mockImplementation((name: string) => {
            switch (name) {
                case 'UseCustomDoxyFile': return false;
                default: return false;
            }
        });

        // Mock fs-extra methods
        mockedFs.pathExists.mockResolvedValue(true);
        mockedFs.ensureDir.mockResolvedValue(undefined as any);
        mockedFs.readFile.mockResolvedValue('# Sample Doxyfile content\nOUTPUT_DIRECTORY = /old/path');
        mockedFs.writeFile.mockResolvedValue(undefined as any);
        mockedFs.remove.mockResolvedValue(undefined as any);

        // Mock execAsync
        mockExecAsync.mockResolvedValue({ stdout: 'doxygen 1.9.1', stderr: '' });
    });

    describe('Constructor and Input Parsing', () => {
        test('should create DoxygenTask and parse inputs correctly', () => {
            doxygenTask = new DoxygenTask();

            expect(mockedTl.getPathInput).toHaveBeenCalledWith('sourceDirectory', true);
            expect(mockedTl.getPathInput).toHaveBeenCalledWith('outputDirectory', true);
            expect(mockedTl.getInput).toHaveBeenCalledWith('ProjectName', true);
            expect(mockedTl.getInput).toHaveBeenCalledWith('ProjectVersion', false);
            expect(mockedTl.getInput).toHaveBeenCalledWith('SourceFilePattern', true);
            expect(mockedTl.getBoolInput).toHaveBeenCalledWith('UseCustomDoxyFile', true);
            expect(mockedTl.getPathInput).toHaveBeenCalledWith('CustomDoxyFilePath', false);
        });

        test('should use default values when inputs are not provided', () => {
            mockedTl.getPathInput.mockReturnValue(undefined);
            mockedTl.getInput.mockReturnValue(undefined);

            doxygenTask = new DoxygenTask();

            expect(doxygenTask).toBeDefined();
        });
    });

    describe('Doxygen Installation Check', () => {
        test('should detect when Doxygen is available', async () => {
            mockExecAsync.mockResolvedValue({ stdout: 'doxygen 1.9.1', stderr: '' });

            doxygenTask = new DoxygenTask();
            const result = await doxygenTask.checkDoxygenInstallation();

            expect(result).toBe(true);
            expect(mockExecAsync).toHaveBeenCalledWith('doxygen --version');
        });

        test('should detect when Doxygen is not available', async () => {
            mockExecAsync.mockRejectedValue(new Error('Command not found'));

            doxygenTask = new DoxygenTask();
            const result = await doxygenTask.checkDoxygenInstallation();

            expect(result).toBe(false);
        });
    });

    describe('Input Validation', () => {
        test('should pass validation when Doxygen is available and not using custom file', async () => {
            mockExecAsync.mockResolvedValue({ stdout: 'doxygen 1.9.1', stderr: '' });

            doxygenTask = new DoxygenTask();

            await expect(doxygenTask.validateInputs()).resolves.not.toThrow();
            expect(mockedFs.ensureDir).toHaveBeenCalledWith('/test/output');
        });

        test('should fail validation when Doxygen is not available', async () => {
            mockExecAsync.mockRejectedValue(new Error('Command not found'));

            doxygenTask = new DoxygenTask();

            await doxygenTask.validateInputs();

            expect(mockedTl.setResult).toHaveBeenCalledWith(
                mockedTl.TaskResult.Failed,
                'DoxygenNotFound: '
            );
        });

        test('should validate custom doxyfile when UseCustomDoxyFile is true', async () => {
            mockExecAsync.mockResolvedValue({ stdout: 'doxygen 1.9.1', stderr: '' });
            mockedTl.getBoolInput.mockImplementation((name: string) =>
                name === 'UseCustomDoxyFile' ? true : false
            );

            doxygenTask = new DoxygenTask();

            await expect(doxygenTask.validateInputs()).resolves.not.toThrow();
            expect(mockedFs.pathExists).toHaveBeenCalled();
        });

        test('should fail when custom doxyfile is enabled but path not provided', async () => {
            mockExecAsync.mockResolvedValue({ stdout: 'doxygen 1.9.1', stderr: '' });
            mockedTl.getBoolInput.mockImplementation((name: string) =>
                name === 'UseCustomDoxyFile' ? true : false
            );
            mockedTl.getPathInput.mockImplementation((name: string) => {
                if (name === 'CustomDoxyFilePath') return undefined;
                return name === 'sourceDirectory' ? '/test/source' : '/test/output';
            });

            doxygenTask = new DoxygenTask();

            await doxygenTask.validateInputs();

            expect(mockedTl.setResult).toHaveBeenCalledWith(
                mockedTl.TaskResult.Failed,
                'Custom Doxyfile path is required when using custom configuration file option'
            );
        });

        test('should fail when custom doxyfile does not exist', async () => {
            mockExecAsync.mockResolvedValue({ stdout: 'doxygen 1.9.1', stderr: '' });
            mockedTl.getBoolInput.mockImplementation((name: string) =>
                name === 'UseCustomDoxyFile' ? true : false
            );
            mockedFs.pathExists.mockResolvedValue(false as any);

            doxygenTask = new DoxygenTask();

            await doxygenTask.validateInputs();

            expect(mockedTl.setResult).toHaveBeenCalledWith(
                mockedTl.TaskResult.Failed,
                expect.stringContaining('ConfigFileNotFound')
            );
        });
    });

    describe('Auto Doxyfile Generation', () => {
        test('should generate valid Doxyfile content with project information', () => {
            doxygenTask = new DoxygenTask();

            const doxyfileContent = doxygenTask.generateAutoDoxyfile();

            expect(doxyfileContent).toContain('PROJECT_NAME           = "Test Project"');
            expect(doxyfileContent).toContain('PROJECT_NUMBER         = "1.0.0"');
            expect(doxyfileContent).toContain('FILE_PATTERNS          = *.cpp *.h');
            expect(doxyfileContent).toContain('INPUT                  = /test/source');
            expect(doxyfileContent).toContain('OUTPUT_DIRECTORY       = /test/output');
            expect(doxyfileContent).toContain('GENERATE_HTML          = YES');
            expect(doxyfileContent).toContain('EXTRACT_ALL            = YES');
        });
    });

    describe('Documentation Generation', () => {
        test('should generate documentation using auto-generated config', async () => {
            mockExecAsync.mockResolvedValue({
                stdout: 'Documentation generated successfully',
                stderr: ''
            });

            // Mock process methods
            const originalCwd = process.cwd;
            const originalChdir = process.chdir;
            const mockChdir = jest.fn();
            process.cwd = jest.fn().mockReturnValue('/original');
            process.chdir = mockChdir;

            doxygenTask = new DoxygenTask();

            await doxygenTask.generateDocumentation();

            expect(mockChdir).toHaveBeenCalledWith('/test/source');
            expect(mockedFs.writeFile).toHaveBeenCalled();
            expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('doxygen'));
            expect(mockedFs.remove).toHaveBeenCalled();
            expect(mockChdir).toHaveBeenCalledWith('/original');

            // Restore original functions
            process.cwd = originalCwd;
            process.chdir = originalChdir;
        });

        test('should generate documentation using custom config', async () => {
            mockExecAsync.mockResolvedValue({
                stdout: 'Documentation generated successfully',
                stderr: ''
            });
            mockedTl.getBoolInput.mockImplementation((name: string) =>
                name === 'UseCustomDoxyFile' ? true : false
            );

            // Mock process methods
            const originalCwd = process.cwd;
            const originalChdir = process.chdir;
            const mockChdir = jest.fn();
            process.cwd = jest.fn().mockReturnValue('/original');
            process.chdir = mockChdir;

            doxygenTask = new DoxygenTask();

            await doxygenTask.generateDocumentation();

            expect(mockedFs.readFile).toHaveBeenCalled();
            expect(mockedFs.writeFile).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('OUTPUT_DIRECTORY = /test/output')
            );

            // Restore original functions
            process.cwd = originalCwd;
            process.chdir = originalChdir;
        });

        test('should handle doxygen execution errors', async () => {
            mockExecAsync.mockRejectedValue(new Error('Doxygen failed'));

            // Mock process methods to avoid issues
            const originalCwd = process.cwd;
            const originalChdir = process.chdir;
            process.cwd = jest.fn().mockReturnValue('/original');
            process.chdir = jest.fn();

            doxygenTask = new DoxygenTask();

            await expect(doxygenTask.generateDocumentation()).rejects.toThrow();
            expect(mockedTl.setResult).toHaveBeenCalledWith(
                mockedTl.TaskResult.Failed,
                expect.stringContaining('Failed to generate documentation')
            );

            // Restore original functions
            process.cwd = originalCwd;
            process.chdir = originalChdir;
        });
    });

    describe('Artifact Publishing', () => {
        test('should publish artifacts successfully', async () => {
            doxygenTask = new DoxygenTask();

            await doxygenTask.publishArtifacts();

            expect(mockedTl.uploadArtifact).toHaveBeenCalledWith(
                'documentation',
                '/test/output',
                'documentation'
            );
        });

        test('should handle artifact publishing errors gracefully', async () => {
            mockedTl.uploadArtifact.mockImplementation(() => {
                throw new Error('Upload failed');
            });

            doxygenTask = new DoxygenTask();

            // Should not throw, just log warning
            await expect(doxygenTask.publishArtifacts()).resolves.not.toThrow();
        });
    });

    describe('Full Task Execution', () => {
        test('should run complete task successfully', async () => {
            mockExecAsync.mockResolvedValue({
                stdout: 'Documentation generated successfully',
                stderr: ''
            });

            // Mock process methods
            const originalCwd = process.cwd;
            const originalChdir = process.chdir;
            const mockChdir = jest.fn();
            process.cwd = jest.fn().mockReturnValue('/original');
            process.chdir = mockChdir;

            doxygenTask = new DoxygenTask();

            await doxygenTask.run();

            expect(mockedTl.setResult).toHaveBeenCalledWith(
                mockedTl.TaskResult.Succeeded,
                'Documentation generated successfully'
            );

            // Restore original functions
            process.cwd = originalCwd;
            process.chdir = originalChdir;
        });

        test('should handle task execution errors', async () => {
            mockExecAsync.mockRejectedValue(new Error('Task failed'));

            // Mock process methods to avoid issues
            const originalCwd = process.cwd;
            const originalChdir = process.chdir;
            process.cwd = jest.fn().mockReturnValue('/original');
            process.chdir = jest.fn();

            doxygenTask = new DoxygenTask();

            await doxygenTask.run();

            expect(mockedTl.setResult).toHaveBeenCalledWith(
                mockedTl.TaskResult.Failed,
                expect.stringContaining('Task failed')
            );

            // Restore original functions
            process.cwd = originalCwd;
            process.chdir = originalChdir;
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle stderr warnings in doxygen output', async () => {
            mockExecAsync.mockResolvedValue({
                stdout: 'Documentation generated',
                stderr: 'Warning: Some documentation issues found'
            });

            // Mock process methods
            const originalCwd = process.cwd;
            const originalChdir = process.chdir;
            process.cwd = jest.fn().mockReturnValue('/original');
            process.chdir = jest.fn();

            doxygenTask = new DoxygenTask();

            await expect(doxygenTask.generateDocumentation()).resolves.not.toThrow();

            // Restore original functions
            process.cwd = originalCwd;
            process.chdir = originalChdir;
        });

        test('should handle empty project version gracefully', () => {
            mockedTl.getInput.mockImplementation((name: string) => {
                switch (name) {
                    case 'ProjectName': return 'Test Project';
                    case 'ProjectVersion': return undefined; // Empty version
                    case 'SourceFilePattern': return '*.cpp *.h';
                    default: return undefined;
                }
            });

            doxygenTask = new DoxygenTask();
            const doxyfileContent = doxygenTask.generateAutoDoxyfile();

            expect(doxyfileContent).toContain('PROJECT_NUMBER         = "1.0"'); // Default version
        });
    });
});
