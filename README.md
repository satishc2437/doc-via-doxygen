# Doc via Doxygen

An Azure DevOps extension that generates documentation using Doxygen and publishes it as build artifacts.

## Features

- 📚 Generate documentation using Doxygen
- 🔧 Auto-generated Doxygen configuration or use custom Doxyfile
- 🏷️ Configurable project name and version
- 🎯 Flexible source file pattern matching
- 📁 Automatic artifact publishing
- 🛠️ Easy integration with Azure DevOps pipelines
- 🧪 Comprehensive testing with mocked dependencies
- 🏗️ Multi-component architecture (Pipeline Task + Code Hub + Extension)

## Project Structure

```
Q:/repos/doc-via-doxygen/
├── src/                           # Source code
│   ├── pipeline-task/             # Azure DevOps pipeline task
│   │   ├── src/index.ts          # Main task implementation
│   │   └── task.json             # Task configuration
│   ├── code-hub/                  # Code Hub integration (planned)
│   │   └── index.ts              # Code Hub integration
│   └── extension/                 # Extension manifest (future)
├── test/                          # Test files
│   ├── pipeline-task/             # Pipeline task tests
│   │   ├── index.test.ts         # Comprehensive unit tests
│   │   └── jest-setup.js         # Jest environment setup
│   └── code-hub/                  # Code Hub tests
├── build/                         # Build scripts
├── dist/                          # Compiled output and packages
│   ├── pipeline-task/             # Compiled pipeline task files
│   ├── code-hub/                  # Compiled Code Hub files
│   └── extension/                 # Packaged extension files (.vsix)
├── node_modules/                  # Project dependencies
├── jest.config.js                 # Unified Jest configuration
├── tsconfig.json                  # Main TypeScript configuration
├── tsconfig.test.json             # Test-specific TypeScript configuration
├── tsconfig.pipeline-task.json    # Pipeline task build configuration
├── tsconfig.code-hub.json         # Code hub build configuration
├── package.json                   # Root project configuration
├── README.md                      # This file
└── .gitignore                     # Git ignore rules
```

## Quick Start

```bash
# Install dependencies
npm install

# Build all components
npm run build

# Run all tests
npm test

# Package extension (when ready)
npm run package:extension
```

## Pipeline Task

The main component is an Azure DevOps pipeline task for generating documentation with Doxygen.

### Prerequisites

- Doxygen must be installed on the build agent
- Source code with appropriate documentation comments (optional - Doxygen can extract structure without comments)
- A custom Doxygen configuration file (optional - task can auto-generate one)

### Task Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `sourceDirectory` | Yes | `$(Build.SourcesDirectory)` | Root directory containing source code |
| `outputDirectory` | Yes | `$(Build.ArtifactStagingDirectory)/docs` | Output directory for generated docs |
| `ProjectName` | Yes | `My Project` | Project name to be mentioned in the documentation |
| `ProjectVersion` | No | `1.0` | Project version to be mentioned in the documentation |
| `SourceFilePattern` | Yes | `*.cs *.ts *.js *.c *.java *.cpp` | Space separated file patterns to document |
| `UseCustomDoxyFile` | Yes | `false` | Whether to use a custom Doxygen configuration file |
| `CustomDoxyFilePath` | Conditional | - | Path to custom Doxyfile (required if UseCustomDoxyFile is true) |

### Usage Examples

#### Auto-generated Configuration (Recommended)

```yaml
# azure-pipelines.yml
steps:
- task: DocViaDoxygen@1
  displayName: 'Generate Documentation'
  inputs:
    sourceDirectory: '$(Build.SourcesDirectory)'
    outputDirectory: '$(Build.ArtifactStagingDirectory)/documentation'
    ProjectName: 'My Awesome Project'
    ProjectVersion: '$(Build.BuildNumber)'
    SourceFilePattern: '*.cpp *.h *.cs *.java'
    UseCustomDoxyFile: false
```

#### Custom Doxyfile Configuration

```yaml
# azure-pipelines.yml
steps:
- task: DocViaDoxygen@1
  displayName: 'Generate Documentation'
  inputs:
    sourceDirectory: '$(Build.SourcesDirectory)'
    outputDirectory: '$(Build.ArtifactStagingDirectory)/documentation'
    ProjectName: 'My Project'
    ProjectVersion: '1.0'
    SourceFilePattern: '*.cpp *.h'
    UseCustomDoxyFile: true
    CustomDoxyFilePath: 'docs/Doxyfile'
```

### Task Implementation Details

The pipeline task performs the following steps:

1. **Validation**: Checks if Doxygen is installed and validates configuration options
2. **Configuration**: Either uses provided custom Doxyfile or generates an optimized one automatically
3. **Documentation Generation**: Runs Doxygen with the configuration
4. **Artifact Publishing**: Automatically publishes generated docs as build artifacts

### Error Handling

The task includes comprehensive error handling for:

- Missing Doxygen installation
- Invalid configuration files
- Documentation generation failures
- Publishing failures (non-fatal for optional features)

## Development

### Development Prerequisites

- Node.js 16 or later
- npm
- TypeScript
- Jest (for testing)

### Build Commands

```bash
# Build specific components
npm run build:pipeline-task     # Build pipeline task
npm run build:code-hub          # Build code hub integration

# Build everything
npm run build

# Clean build artifacts
npm run clean
```

### Testing

#### Available Test Commands

```bash
# Run all tests
npm test

# Test specific components
npm run test:pipeline-task              # Run pipeline task tests
npm run test:pipeline-task:watch        # Run in watch mode
npm run test:pipeline-task:coverage     # Generate coverage report
npm run test:code-hub                   # Run code hub tests
```

#### Test Coverage

✅ **Input Validation and Parsing**

- Task input parsing and validation
- Default value handling
- Custom vs auto-generated configuration logic

✅ **Doxygen Integration**

- Doxygen installation detection
- Configuration file validation
- Documentation generation process

✅ **Auto-Generated Doxyfile**

- Project name and version injection
- File pattern matching
- Configuration optimization

✅ **Error Handling**

- Missing Doxygen executable
- Invalid file paths
- Execution failures
- Graceful error recovery

✅ **Artifact Publishing**

- Successful artifact upload (mocked)
- Error handling during publishing

✅ **Full Integration**

- Complete task execution flow
- Error scenarios and recovery

#### Running Tests Without Doxygen

Since tests are fully mocked, you can run them without Doxygen installed. The task mocks:

- Azure DevOps Task Library
- File system operations
- External Doxygen executable
- Process execution

### Jest Configuration

The project uses modern Jest configuration with ts-jest and centralized testing:

```javascript
transform: {
  '^.+\\.ts$': ['ts-jest', {
    tsconfig: 'tsconfig.test.json'
  }]
}
```

### Import vs Direct Execution

The task works in both testing and production scenarios:

- **✅ Import as Module** (testing): Uses `NODE_ENV=test` to prevent auto-execution
- **✅ Azure DevOps Execution**: Automatically runs when imported
- **✅ Direct Execution**: `node dist/pipeline-task/index.js` runs the complete task

This is achieved using environment variable detection:

```typescript
// Only auto-execute if not in test mode
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
    main().catch(error => { /* handle error */ });
}
```

## Code Hub Integration

Integration with Azure DevOps Code Hub (planned feature for enhanced documentation browsing).

```bash
# Future implementation
npm run build:code-hub
npm run test:code-hub
```

## Extension Packaging

The complete Azure DevOps extension package that includes all components.

```bash
# Build and package everything
npm run build
npm run package:extension
```

## Architecture

This project follows a unified architecture with:

- **Centralized Configuration**: All TypeScript, Jest, and package configurations at root level
- **Component Separation**: Clear separation between pipeline-task, code-hub, and extension
- **Unified Dependencies**: Single node_modules with all dependencies managed at root
- **Consistent Build**: All components use the same build standards and tooling
- **Comprehensive Testing**: Full test coverage with mocked dependencies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.
