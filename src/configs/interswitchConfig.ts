import '../pre-start'; // Must be the first import
import logger from '../shared/Logger';
import {I_Interswitch} from '../database/interface/i_interswitch'
import InterswitchConfigModel from '../database/model/InterswitchConfigModel'

export const updateInterswitchConfig = async (updateData: I_Interswitch) => {
    let updated = false;
    await InterswitchConfigModel.findOneAndUpdate({
        configId: updateData.configId
    }, updateData, { upsert: true }, (err, doc) => {
        if(err){
            logger.err('Interswitch config failed to update: HadError => ' + err)
        } else {
            updated = true;
            logger.info('Interswitch config upserted successfully ' )
        }
    });
                
    return updated
}

export const getInterswitchConfig = async () => {
    //Fetch transaction
    const config = await InterswitchConfigModel.findOne({
        configId: 1001
    }).lean()

    if(config){
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return config;
    } else {
        return false
    }
}