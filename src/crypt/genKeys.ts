import * as crypto from 'crypto'

export default function generateSecretKey(){
    const token = crypto.randomBytes(48).toString('hex');
    return token;
}



