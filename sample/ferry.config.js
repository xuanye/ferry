module.exports = {
    modules: [
        {
            name: '测试环境',
            env: 'dev',
            ssh: {
                host: '129.211.73.104',
                port: 22,
                username: 'root',
                privateKey: require('fs').readFileSync(`${require('os').homedir()}/.ssh/github_rsa`), //通用写法
            },
            nobackup: false /* 是否备份 */,
            diff: true /*开启差异化（diff）发布 */,
            buildBash: 'sh',
            buildCommand: './build.sh',
            localPath: './dist' /* 本地需要发布的根目录 */,
            localPathIgnore: '**/*.map' /* 忽略的文件 */,
            localTarFileDir: './tmp' /* 临时压缩包的目录 */,
            tarFilename: 'helloFerry' /* 临时压缩包的名称 */,
            remotePath: '/opt/data/sample',
            preCommands: ['echo Hello'] /*前置处理命令 */,
            postCommands: ['echo last'] /* 执行成功后的后处理命令 */,
        },
    ],
};
