/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable prefer-const */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";

class Unpack {

    binaryBitmap: any
    dataElementPart: any
    config: any
    dataElements: any

    constructor(binaryBitmap: any, dataElementPart: any, config: any = null){

        this.binaryBitmap = binaryBitmap;
        this.dataElementPart = dataElementPart;

        const defaultConfig = require(__dirname + '/dataelement-config.json');

        if(config !== null){

            this.config = config ;

        } else {

            this.config = defaultConfig;

        }

        this.dataElements = {};

    }

    getElement(field: any, currentDataElementPart: any,hexDataPart = false){

        //Get the field data using the config
        const fieldConfig = this.config[field];
        let dataLength, variableLength, fieldLength, nextDataElementPart, fieldData;

        if(fieldConfig.fixedLength === true){

            variableLength = 0;
            dataLength = fieldConfig.contentLength;

        } else {

            //Get the number of length characters LL, LLL, etc
            variableLength = fieldConfig.contentLength;
            if(hexDataPart)
            {
                variableLength*= 2;
                dataLength = parseInt(Buffer.from(currentDataElementPart.substring(0, variableLength),'hex').toString('utf8')); 
            }
            else
                dataLength = parseInt(currentDataElementPart.substring(0, variableLength));

        }

        fieldLength = dataLength + variableLength;
        if(hexDataPart == true && fieldConfig.contentType != 'b')
        {    fieldLength= (dataLength*2)+variableLength;
            // fieldLength*= 2;
        }    

        fieldData = currentDataElementPart.substring(variableLength, fieldLength);
        if(hexDataPart)
        {
            if(fieldConfig.contentType != 'b' && field != 127)
                fieldData = Buffer.from(fieldData,'hex').toString('utf8');
        }

        nextDataElementPart = currentDataElementPart.substring(fieldLength);

        const response = {
            nextDataElementPart: nextDataElementPart,
            fieldNumber: field,
            fieldData: fieldData,
            fieldLength: fieldLength,
            dataLength: dataLength,
            slug: fieldConfig.slug,
            valid: true
        }
        
        //TODO: Validate the field; length and value

        return response;

    }

    getDataElements(hexDataPart = false){

        let currentDataElementPart = this.dataElementPart;

        //Loop through the Bitmap
        for(let i =  1; i < this.binaryBitmap.length; i++){

            const field = i + 1;
            let elementData;

            if(this.binaryBitmap[i] == "0"){

                //Field is not present
                this.dataElements[field] = null;

            } else {

                //Field is present
                elementData = this.getElement(field, currentDataElementPart,hexDataPart);

                this.dataElements[field] = elementData.fieldData;

                //Set the current data element part after taking out the data of the previous field
                currentDataElementPart = elementData.nextDataElementPart;

            }

        }

        return this.dataElements;

    }

}

export default Unpack;
