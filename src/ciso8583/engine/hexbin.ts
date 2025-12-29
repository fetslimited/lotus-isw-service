/* eslint-disable @typescript-eslint/no-unsafe-call */
"use strict";

class HexBin {

    hexadecimalCharacterToBin(hexadecimalChar:any, padded = true){

        let binValue = parseInt(hexadecimalChar, 16).toString(2);

        if(padded){
            binValue = binValue.padStart(4, '0');
        }

        return binValue;

    }

    hex2Bin(theHex: any){

        let binResult = "";

        theHex.split("").forEach((hexadecimalChar: any) => {
            binResult += this.hexadecimalCharacterToBin(hexadecimalChar, true);
        });

        return binResult;

    }

    bin2Hex(theBin: any){

        const hexValue = parseInt(theBin, 2).toString(16).toUpperCase();

        return hexValue;

    }

    binaryCharactersToHex(theBinaryCharacters: any){

        let theHexadecimal = '';

        for (let i = 0; i < theBinaryCharacters.length; i = i + 4){

            const theBinChars = theBinaryCharacters.substr(i, 4);
            const theHex = this.bin2Hex(theBinChars);

            theHexadecimal += theHex;

        }

        return theHexadecimal;

    }

}

export default HexBin;