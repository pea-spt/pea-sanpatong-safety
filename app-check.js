import {appCheckSiteKey} from './config.js';
import {initializeAppCheck,ReCaptchaEnterpriseProvider,getToken} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js';
export async function protectApp(app){const check=initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(appCheckSiteKey),isTokenAutoRefreshEnabled:true});await getToken(check,false);return check;}
