/**
 * MCP Git Server - MCP сервер для работы с git-репозиторием
 * Предоставляет информацию о текущей ветке, коммитах, файлах и т.д.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class MCPGitServer {
    constructor(repoPath = process.cwd()) {
        this.repoPath = repoPath;
    }

    /**
     * Получение списка всех доступных инструментов
     */
    getTools() {
        return [
            {
                name: 'git_current_branch',
                description: 'Получить название текущей git-ветки',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'git_status',
                description: 'Получить статус репозитория (измененные, добавленные, удаленные файлы)',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'git_recent_commits',
                description: 'Получить последние коммиты в текущей ветке',
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: 'Количество коммитов (по умолчанию 10)',
                            default: 10
                        }
                    },
                    required: []
                }
            },
            {
                name: 'git_file_history',
                description: 'Получить историю изменений конкретного файла',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filepath: {
                            type: 'string',
                            description: 'Путь к файлу относительно корня репозитория'
                        },
                        limit: {
                            type: 'number',
                            description: 'Количество коммитов (по умолчанию 5)',
                            default: 5
                        }
                    },
                    required: ['filepath']
                }
            },
            {
                name: 'git_branches',
                description: 'Получить список всех веток в репозитории',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'git_diff',
                description: 'Получить изменения в рабочей директории',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filepath: {
                            type: 'string',
                            description: 'Путь к конкретному файлу (опционально)'
                        }
                    },
                    required: []
                }
            },
            {
                name: 'git_blame',
                description: 'Показать, кто и когда изменял каждую строку файла',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filepath: {
                            type: 'string',
                            description: 'Путь к файлу'
                        }
                    },
                    required: ['filepath']
                }
            },
            {
                name: 'git_contributors',
                description: 'Получить список контрибьюторов проекта',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        ];
    }

    /**
     * Выполнение git команды
     */
    async execGit(command) {
        try {
            const { stdout, stderr } = await execAsync(`git ${command}`, {
                cwd: this.repoPath
            });
            
            if (stderr && !stderr.includes('warning:')) {
                throw new Error(stderr);
            }
            
            return stdout.trim();
        } catch (error) {
            throw new Error(`Git error: ${error.message}`);
        }
    }

    /**
     * Выполнение инструмента
     */
    async executeTool(toolName, args = {}) {
        console.log(`[Git MCP] Выполнение: ${toolName}`, args);

        switch (toolName) {
            case 'git_current_branch':
                return await this.getCurrentBranch();
            case 'git_status':
                return await this.getStatus();
            case 'git_recent_commits':
                return await this.getRecentCommits(args.limit || 10);
            case 'git_file_history':
                return await this.getFileHistory(args.filepath, args.limit || 5);
            case 'git_branches':
                return await this.getBranches();
            case 'git_diff':
                return await this.getDiff(args.filepath);
            case 'git_blame':
                return await this.getBlame(args.filepath);
            case 'git_contributors':
                return await this.getContributors();
            default:
                throw new Error(`Неизвестный инструмент: ${toolName}`);
        }
    }

    /**
     * Получить текущую ветку
     */
    async getCurrentBranch() {
        const branch = await this.execGit('rev-parse --abbrev-ref HEAD');
        return {
            success: true,
            branch,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Получить статус репозитория
     */
    async getStatus() {
        const status = await this.execGit('status --porcelain');
        
        const files = {
            modified: [],
            added: [],
            deleted: [],
            untracked: []
        };

        if (status) {
            const lines = status.split('\n');
            for (const line of lines) {
                if (!line) continue;
                
                const statusCode = line.substring(0, 2);
                const filepath = line.substring(3);

                if (statusCode.includes('M')) files.modified.push(filepath);
                else if (statusCode.includes('A')) files.added.push(filepath);
                else if (statusCode.includes('D')) files.deleted.push(filepath);
                else if (statusCode.includes('??')) files.untracked.push(filepath);
            }
        }

        const totalChanges = files.modified.length + files.added.length + 
                            files.deleted.length + files.untracked.length;

        return {
            success: true,
            clean: totalChanges === 0,
            files,
            totalChanges,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Получить последние коммиты
     */
    async getRecentCommits(limit = 10) {
        const format = '%H|%an|%ae|%ad|%s';
        const commits = await this.execGit(`log -${limit} --pretty=format:"${format}" --date=iso`);
        
        const commitsList = [];
        if (commits) {
            const lines = commits.split('\n');
            for (const line of lines) {
                const [hash, author, email, date, message] = line.split('|');
                commitsList.push({
                    hash: hash.substring(0, 7),
                    fullHash: hash,
                    author,
                    email,
                    date,
                    message
                });
            }
        }

        return {
            success: true,
            commits: commitsList,
            count: commitsList.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Получить историю файла
     */
    async getFileHistory(filepath, limit = 5) {
        const format = '%H|%an|%ad|%s';
        const history = await this.execGit(`log -${limit} --pretty=format:"${format}" --date=short -- "${filepath}"`);
        
        const commits = [];
        if (history) {
            const lines = history.split('\n');
            for (const line of lines) {
                const [hash, author, date, message] = line.split('|');
                commits.push({
                    hash: hash.substring(0, 7),
                    author,
                    date,
                    message
                });
            }
        }

        return {
            success: true,
            filepath,
            commits,
            count: commits.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Получить список веток
     */
    async getBranches() {
        const branchesOutput = await this.execGit('branch -a');
        
        const branches = {
            current: null,
            local: [],
            remote: []
        };

        if (branchesOutput) {
            const lines = branchesOutput.split('\n');
            for (const line of lines) {
                if (!line) continue;
                
                const isCurrent = line.startsWith('*');
                const branchName = line.replace('*', '').trim();
                
                if (isCurrent) {
                    branches.current = branchName;
                }
                
                if (branchName.startsWith('remotes/')) {
                    branches.remote.push(branchName);
                } else {
                    branches.local.push(branchName);
                }
            }
        }

        return {
            success: true,
            branches,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Получить diff
     */
    async getDiff(filepath = null) {
        let diff;
        if (filepath) {
            diff = await this.execGit(`diff -- "${filepath}"`);
        } else {
            diff = await this.execGit('diff');
        }

        return {
            success: true,
            filepath: filepath || 'all',
            diff,
            hasChanges: diff.length > 0,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Git blame - кто изменял файл
     */
    async getBlame(filepath) {
        const blame = await this.execGit(`blame --line-porcelain "${filepath}"`);
        
        // Парсим blame output (упрощенная версия)
        const lines = [];
        const blameLines = blame.split('\n');
        let currentCommit = null;
        
        for (const line of blameLines) {
            if (line.match(/^[0-9a-f]{40}/)) {
                currentCommit = line.split(' ')[0].substring(0, 7);
            } else if (line.startsWith('author ')) {
                const author = line.substring(7);
                lines.push({ commit: currentCommit, author });
            }
        }

        return {
            success: true,
            filepath,
            lines,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Получить контрибьюторов
     */
    async getContributors() {
        const contributors = await this.execGit('shortlog -sn --all --no-merges');
        
        const list = [];
        if (contributors) {
            const lines = contributors.split('\n');
            for (const line of lines) {
                if (!line) continue;
                const match = line.trim().match(/^(\d+)\s+(.+)$/);
                if (match) {
                    list.push({
                        commits: parseInt(match[1]),
                        name: match[2]
                    });
                }
            }
        }

        return {
            success: true,
            contributors: list,
            count: list.length,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = MCPGitServer;

