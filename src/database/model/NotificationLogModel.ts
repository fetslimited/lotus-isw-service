/* eslint-disable max-len */
import mongoose from 'mongoose'
import notificationLogSchema from '../schema/notificationLogSchema';
import {INotificationLog} from '../interface/i_notificationlog';

const NotificationLogModel = mongoose.model<INotificationLog>('notification_logs', notificationLogSchema);

export default NotificationLogModel