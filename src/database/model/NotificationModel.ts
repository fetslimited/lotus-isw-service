import mongoose from 'mongoose'
import notificationSchema from '../schema/notificationSchema';
import {INotification} from '../interface/i_notification';

const NotificationModel = mongoose.model<INotification>('notification', notificationSchema);

export default NotificationModel