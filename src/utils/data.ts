
import switchUptimeModel from '../database/model/switchUptimeModel'
import logger from '../shared/Logger';



export function getSlackMessage(type: string){
    let MSG = {};
    var blastId = Math.floor(1000 + Math.random() * 9000);
    switch (type){
        case "ISW_SWITCH_CONNECTION_DOWN":
                MSG = {
                    'username': 'fetsTMS Moneytor', // This will appear as user name who posts the message
                    'text': 'Socket connection just went down! Transaction time-outs will occur. Please check immediately!!', // text
                    'icon_emoji': ':bangbang:', // User icon, you can also use custom icons here
                    'attachments': [{ // this defines the attachment block, allows for better layout usage
                        'color': '#eed140', // color of the attachments sidebar.
                        'fields': [ // actual fields
                            {
                                'title': 'Environment', // Custom field
                                'value': 'Production', // Custom value
                                'short': true // long fields will be full width
                            },
                            {
                                'title': 'App Type',
                                'value': 'ISW (Interswitch)',
                                'short': true
                            },
                            {
                                'title': 'BlastID',
                                'value': blastId,
                                'short': true
                            }
                        ]
                    }]
                };
            return MSG
        case "ISW_SWITCH_CONNECTION_UP":
                 MSG = {
                    'username': 'fetsTMS Moneytor', // This will appear as user name who posts the message
                    'text': 'Socket connection is back up! Transaction processing fine. Cheers!', // text
                    'icon_emoji': ':white_check_mark:', // User icon, you can also use custom icons here
                    'attachments': [{ // this defines the attachment block, allows for better layout usage
                        'color': '#eed140', // color of the attachments sidebar.
                        'fields': [ // actual fields
                            {
                                'title': 'Environment', // Custom field
                                'value': 'Production', // Custom value
                                'short': true // long fields will be full width
                            },
                            {
                                'title': 'App Type',
                                'value': 'ISW (Interswitch)',
                                'short': true
                            },
                            {
                                'title': 'BlastID',
                                'value': blastId,
                                'short': true
                            }
                        ]
                    }]
                };
            return MSG
        default:
            return MSG
    }
}

export async function updateSwitchStatus(status: string){

    let obj = {'interswitch': status}
    const refid = "0xxx90k78hjuiP"
    if (refid) {
        await switchUptimeModel.findOneAndUpdate({refid: refid}, obj, {upsert: true}, function (err: any, doc: any) {
            if(err){
                logger.err('Error: Could not update switch status' + JSON.stringify(err))
            } else {
                logger.info('Success: Update switch status: ' + status)
            }
        });
    }
    
}