// eslint-disable-next-line max-len
import fs = require('fs');

export default function MtiRequestTypes(){
    const appEnv = process.env.NODE_ENV
    let data;
    if(appEnv == "local"){
        data = fs.readFileSync(process.cwd() + '/src/configs/requesttypes.json');
    } else {
        data = fs.readFileSync(process.cwd() + '/dist/configs/requesttypes.json');
    }

    const dataArray = JSON.parse(data.toString()) 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return dataArray;
}