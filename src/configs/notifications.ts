
const notificationsConfig = (alias: string) => {
    switch (alias) {
        case "flutterwave":

            return {
                "notificationEndpoint": "/flwvpos/api/pos/notification",
                "contentType": "application/json",
                "retrial": "3",
                "authType": "Basic"
            }

        default:
            return {};
  
    }

};

export default notificationsConfig