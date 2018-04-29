module.exports = {    
    modules: [{
        name: '开发环境',
        env: 'dev',
        ssh: {
            host: '192.168.1.13',
            port: 22,
            username: 'xuanye',           
            privateKey: require('fs').readFileSync(`${require('os').homedir()}/.ssh/id_rsa`)  //通用写法
        },
        nobackup:false,/* 是否备份 */
        diff:true, /*开启差异化（diff）发布 */ 
        buildBash:"sh",     
        buildCommand: './build',
        localPath: './dist/helloFerry',/* 本地需要发布的根目录 */       
        localPathIgnore: '**/*.map', /* 忽略的文件 */
        localTarFileDir:"./tmp", /* 临时压缩包的目录 */
        tarFilename:"helloFerry", /* 临时压缩包的名称 */
        remotePath: '/home/xuanye/app/ferry-t1',
        preCommands:["echo Hello"], /*前置处理命令 */
        postCommands: ['pm2 restart hello-ferry']  /* 执行成功后的后处理命令 */
    }] 
}