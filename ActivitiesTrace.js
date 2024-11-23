var context = null;
var packageName = null;
var lastForegroundActivity = null;
var startTime = null;
var timer = null;

const pageSwitchMap = {};// ���ڴ洢ҳ����ת��ϵ�Ķ��󣬸�ʽ�� "A":{ "Switch":{"B","C"}}
const filePath = './page_switch_history.json';
const checkFrequency = 1000  //���Ƶ�� 1s
const totalTime = 60000;     //���ʱ�� 60s 

//��չconsole
(function () {
    let Color = { RESET: "\x1b[39;49;00m", Black: "0;01", Blue: "4;01", Cyan: "6;01", Gray: "7;11", "Green": "2;01", Purple: "5;01", Red: "1;01", Yellow: "3;01" };
    let LightColor = { RESET: "\x1b[39;49;00m", Black: "0;11", Blue: "4;11", Cyan: "6;11", Gray: "7;01", "Green": "2;11", Purple: "5;11", Red: "1;11", Yellow: "3;11" };
    var colorPrefix = '\x1b[3', colorSuffix = 'm';
    for (let c in Color) {
        if (c == "RESET") continue;
        console[c] = function (message) {
            console.log(colorPrefix + Color[c] + colorSuffix + message + Color.RESET);
        }
        console["Light" + c] = function (message) {
            console.log(colorPrefix + LightColor[c] + colorSuffix + message + Color.RESET);
        }
    }
})();

function getContextPackageName() {
    context = Java.use("android.app.ActivityThread").currentApplication().getApplicationContext();
    packageName = context.getPackageName();
}


//��ȡ�ڴ�������activity
function getActivities() {
    const GET_ACTIVITIES = 0x00000001;
    var PackageManager = context.getPackageManager();
    const packageInfo = PackageManager.getPackageInfo(packageName, GET_ACTIVITIES);
    //��ȡȫ����activities
    const activityInfos = packageInfo.activities.value.map((activityInfo) => {
        const activityName = activityInfo.name.value;
        if(pageSwitchMap[activityName]){
            pageSwitchMap[activityName]["LaunchMode"].add(activityInfo.launchMode.value);//����ģʽ
            pageSwitchMap[activityName]["Exported"].add(activityInfo.exported.value);//����ģʽ
            let permissions;
            if (activityInfo.permissions) {
                permissions = activityInfo.permissions.map((perm) => perm.name.value);
            } else {
                permissions = [];
            }
            pageSwitchMap[activityName]["Permissions"].add(permissions);//Ȩ��
        }
    });
}


// ���庯��R�����ڻ�ȡ��׿Ӧ����ָ����Դ�ı�ʶ��
function R(name, type) {
    // ͨ�������Ķ����ȡ��Դ�������Resources��������getIdentifier��������ȡָ����Դ�ı�ʶ��
    return context.getResources().getIdentifier(name, type, packageName);
}

function GetNowActivityName() {
    var activityThread = Java.use("android.app.ActivityThread");
    var activityClientRecord = Java.use("android.app.ActivityThread$ActivityClientRecord");

    const currentActivityThread = activityThread.currentActivityThread();
    const activityRecords = currentActivityThread.mActivities.value.values().toArray();
    for (const i of activityRecords) {
        const activityRecord = Java.cast(i, activityClientRecord);
        if (!activityRecord.paused.value) {
            return Java.cast(Java.cast(activityRecord, activityClientRecord).activity.value, Java.use("android.app.Activity")).$className;
        }
    }
    return null;
}

function checkForegroundActivityChange() {
    var currentActivity = GetNowActivityName();
    if (currentActivity && currentActivity!== lastForegroundActivity) {
        // ��ӡҳ��仯
        console.Blue(lastForegroundActivity);
        console.Yellow("        ======> " + currentActivity);
        
        if (!pageSwitchMap[lastForegroundActivity]) {
            pageSwitchMap[lastForegroundActivity] = {
                "Permissions":new Set(),    /*Ȩ�� */
                "LaunchMode":new Set(),     /*����ģʽ */
                "Exported":new Set(),       /*�������� */
                "Switch": new Set()         /*��ת */
            };
        }
        pageSwitchMap[lastForegroundActivity]["Switch"].add(currentActivity);
        
        lastForegroundActivity = currentActivity;
    }
    const currentTime = Date.now();
    const elapsedTime = currentTime - startTime;
    if (elapsedTime >= totalTime) {
        clearInterval(timer);
        console.Red("Monitoring has ended after 1 minute.");
        
        //��������activities��Ϣ
        getActivities();

        // ��ҳ����ת��ϵ����ת��Ϊ����Ҫ��ĸ�ʽ�Ķ��󣨽�Setת��Ϊ���飩
        const formattedPageSwitchMap = {};
        for (const key in pageSwitchMap) {
            formattedPageSwitchMap[key] = {
                "Switch": Array.from(pageSwitchMap[key]["Switch"]),
                "Permissions": Array.from(pageSwitchMap[key]["Permissions"]),
                "LaunchMode": Array.from(pageSwitchMap[key]["LaunchMode"]),
                "Exported": Array.from(pageSwitchMap[key]["Exported"])
            };
        }
        
        // ת��ΪJSON�ַ�������ӡ���ɸ�Ϊд���ļ��Ȳ�����
        const historyJson = JSON.stringify(formattedPageSwitchMap);
        console.Blue("Switch(JSON):");
        console.log(historyJson);
    }
}

function main() {
    console.Purple("==================Exec Start==================");
    Java.perform(function () {
        getContextPackageName();
        lastForegroundActivity = GetNowActivityName();//��ʼ��
        startTime = Date.now();
        timer = setInterval(checkForegroundActivityChange, 1000);
    })
}
setImmediate(main);