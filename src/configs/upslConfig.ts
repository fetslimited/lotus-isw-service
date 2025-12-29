import '../pre-start'; // Must be the first import
import logger from '../shared/Logger';
import {I_Upsl} from '../database/interface/i_upsl'
import UpslConfigModel from '../database/model/UpslConfigModel'

export const updateUpslConfig = async (updateData: I_Upsl) => {
    let updated = false;
    await UpslConfigModel.findOneAndUpdate({
        configId: updateData.configId
    }, updateData, { upsert: true }, (err, doc) => {
        if(err){
            logger.err('Upsl config failed to update: HadError => ' + err)
        } else {
            updated = true;
            logger.info('Upsl config upserted successfully ' )
        }
    });
                
    return updated
}