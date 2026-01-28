/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable max-len */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
"use strict";

import hexbin from "./engine/hexbin";

const HexBin = new hexbin();

import bitmap from "./engine/bitmap";

import packModule from "./engine/pack";

import unpack from "./engine/unpack";

class Main {

    optionalConfig: any

    constructor(optionalConfig: any = null){

        this.optionalConfig = optionalConfig;

    }

    pack(mti: any, dataElements: any, options: any = null){

        //TODO: Add options such as null MTI and more

        let response: any = {};
        response.error = false;

        const Pack = new packModule(dataElements, this.optionalConfig);
        Pack.setDataElements();

        if(mti !== null){

            Pack.setMTI(mti);

        }

        const binaryBitmap = Pack.binaryBitmap;
        const dataElementPart = Pack.dataElementPart;
        const theMTI = Pack.MTI;
        const secondaryBitmapValue = Pack.secondaryBitmapBit;

        const secondaryBitmap = (secondaryBitmapValue == '1' ? true : false);

        const hexadecimalBitmap = HexBin.binaryCharactersToHex(binaryBitmap);

        const isoMessage = `${theMTI}${hexadecimalBitmap}${dataElementPart}`;

        response.binaryBitmap = binaryBitmap;
        response.hexadecimalBitmap = hexadecimalBitmap;
        response.secondaryBitmap = secondaryBitmap;
        response.dataElementPart = dataElementPart;
        response.mti = theMTI;
        response.isoMessage = isoMessage;

        return response;

    }

    packWithBinaryBitmap(mti: any, dataElements: any, options: any = null){

        //TODO: Add options such as null MTI and more

        let response:any = {};
        response.error = false;

        const Pack = new packModule(dataElements, this.optionalConfig);
        Pack.setDataElements();

        if(mti !== null){

            Pack.setMTI(mti);

        }

        let binaryBitmap = Pack.binaryBitmap;
        let dataElementPart = Pack.dataElementPart;
        let theMTI = Pack.MTI;
        let secondaryBitmapValue = Pack.secondaryBitmapBit;

        let secondaryBitmap = (secondaryBitmapValue == '1' ? true : false);

        let hexadecimalBitmap = HexBin.binaryCharactersToHex(binaryBitmap);

        let binBitmap = Buffer.from(hexadecimalBitmap,'hex').toString('binary');

        let isoMessage = `${theMTI}${binBitmap}${dataElementPart}`;

        let isoMessageBytes = Buffer.concat([Buffer.from(theMTI,'utf8'),Buffer.from(binBitmap,'binary'),Buffer.from(dataElementPart,'utf8')]);

        response.binaryBitmap = binaryBitmap;
        response.hexadecimalBitmap = hexadecimalBitmap;
        response.binBitmap = binBitmap;
        response.secondaryBitmap = secondaryBitmap;
        response.dataElementPart = dataElementPart;
        response.mti = theMTI;
        response.isoMessage = isoMessage;
        response.isoMessageBytes = isoMessageBytes;

        return response;

    }


    packSubFieldWithBinaryBitmap(dataElements: any, config: any = null){

        //TODO: Add options such as null MTI and more

        let response: any = {};
        response.error = false;

        let Pack = new packModule(dataElements, (config ? config : this.optionalConfig));
        Pack.setDataElements();

        let binaryBitmap = Pack.binaryBitmap;
        let dataElementPart = Pack.dataElementPart;
        let secondaryBitmapValue = Pack.secondaryBitmapBit;

        let secondaryBitmap = (secondaryBitmapValue == '1' ? true : false);

        // Ensure bitmap is exactly 64 bits (pad with zeros if needed)
        while (binaryBitmap.length < 64) {
            binaryBitmap += '0';
        }

        let hexadecimalBitmap = HexBin.binaryCharactersToHex(binaryBitmap);

        // Use Buffer to properly handle binary data without string encoding issues
        let bitmapBuffer = Buffer.from(hexadecimalBitmap, 'hex');
        let dataBuffer = Buffer.from(dataElementPart, 'latin1');

        // Concatenate bitmap and data as a single buffer
        let isoMessageBytes = Buffer.concat([bitmapBuffer, dataBuffer]);

        // Create string representation for compatibility (using latin1 to preserve byte values 0-255)
        let isoMessage = isoMessageBytes.toString('latin1');

        response.binaryBitmap = binaryBitmap;
        response.hexadecimalBitmap = hexadecimalBitmap;
        response.binBitmap = bitmapBuffer.toString('latin1');
        response.secondaryBitmap = secondaryBitmap;
        response.dataElementPart = dataElementPart;
        response.isoMessage = isoMessage;
        response.isoMessageBytes = isoMessageBytes;

        return response;

    }

    unpack(message: any, options: any = null){

        //TODO: Add options such as null MTI and more

        let MTILength = 4;

        let theMTI = message.substr(0, 4);

        let Bitmap = new bitmap(HexBin);

        let fullBitmap = Bitmap.getFullBitmap(message, true);

        let secondaryBitmap = ((fullBitmap.length > 64) ? true : false);

        let dataElementPart = message.substring((fullBitmap.length/4) + MTILength, message.length);

        let Unpack = new unpack(fullBitmap, dataElementPart, this.optionalConfig);
        Unpack.getDataElements();

        let dataElements = Unpack.dataElements;

        const response = {
            error: false,
            dataElementPart: dataElementPart,
            binaryBitmap: fullBitmap,
            secondaryBitmap: secondaryBitmap,
            dataElements: dataElements,
            mti: theMTI
        }
        
        return response;

    }

    unpackWithBinaryBitmap(message: any, options: any = null){

        //TODO: Add options such as null MTI and more

        let response: any;
        response.error = false;

        let MTILength = 8;

        let hexMessageWithLength = Buffer.from(message,'hex').toString('hex');

        let hexMessage = hexMessageWithLength.substr(4);

        // console.log('meassge: '+hexMessage);
        
        let hexMTI = hexMessage.substr(0,8);

        let theMTI = Buffer.from(hexMTI,'hex').toString('utf8');

        let Bitmap = new bitmap(HexBin);

        let fullBitmap = Bitmap.getFullBitmapBinaryBitmap(hexMessage, true);

        let secondaryBitmap = ((fullBitmap.length > 64) ? true : false);


        let dataElementPart = hexMessage.substring((fullBitmap.length/4) + MTILength, message.length);

        // console.log('dataelementpath: '+ dataElementPart);

        // let dataElementPartUTF8 = Buffer.from(dataElementPart,'hex').toString('utf8');

        // console.log('data Utf8'+dataElementPartUTF8);

        let Unpack = new unpack(fullBitmap, dataElementPart, this.optionalConfig);
        Unpack.getDataElements(true);

        let dataElements = Unpack.dataElements;

        response.dataElementPart = dataElementPart;
        response.binaryBitmap = fullBitmap;
        response.secondaryBitmap = secondaryBitmap;
        response.dataElements = dataElements;
        response.mti = theMTI;

        return response;

    }

    unpackSubfieldWithBinaryBitmap(message: any, options: any = null){

        //TODO: Add options such as null MTI and more

        let response: any;
        response.error = false;

        let Bitmap = new bitmap(HexBin);

        let hexMessage = message;

        let fullBitmap = Bitmap.getFullBitmapBinaryBitmap(hexMessage);

        let secondaryBitmap = ((fullBitmap.length > 64) ? true : false);


        let dataElementPart = hexMessage.substring((fullBitmap.length/4), message.length);


        let Unpack = new unpack(fullBitmap, dataElementPart, (options ? options : this.optionalConfig));
        Unpack.getDataElements(true);

        let dataElements = Unpack.dataElements;

        response.dataElementPart = dataElementPart;
        response.binaryBitmap = fullBitmap;
        response.secondaryBitmap = secondaryBitmap;
        response.dataElements = dataElements;

        return response;

    }

}

export default Main;

