/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable no-console */
import deploySocketService from '../../src/socket/deploySocketService';
import Upsl from '../../src/controller/switchHandlers/Upsl';
import fs = require('fs');

const socketServiceInstance = new deploySocketService()

// describe("VAS Request test", () => {

//     it("Send data to socket server and log transactio successfully",function() {
//         const data = fs.readFileSync(process.cwd() + '/spec/tests/files/iso0200');
//         const value = socketServiceInstance.runSocketClient(data, "45.33.3.35", "5000")
        
//         expect(value).toBe.toString();
//     });
    
// });

// describe("VAS Request test", () => {

//     it("UPSL Tests", async function() {
//         const Instance = new Upsl();
//         await Instance.signOn();
//         const value = ""
//         expect(value).toBe.toString();
//     });
    
// });

describe("Merchant only request test", () => {

    it("Send data to socket server and log transaction successfully",function() {
        const data = fs.readFileSync(process.cwd() + '/spec/tests/files/isoInterswitch');
        const value = socketServiceInstance.runSocketClient(data, "127.0.0.1", "5000");
        
        expect(value).toBe.toString();
    });

});