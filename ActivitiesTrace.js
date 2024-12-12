var context = null;
var packageName = null;
var class_method = "android.app.ActivityThread";

var lastForegroundActivity = null;
var startTime = null;
var timer = null;
const pageSwitchMap = {};// 用于存储页面跳转关系的对象，格式如 "A":{ "Switch":{"B","C"}}
const filePath = './page_switch_history.json';
const checkFrequency = 1000  //检查频率 1s
const totalTime = 60000;     //监控时长 60s 

//扩展console
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
//获取包名
function getContextPackageName() {
  context = Java.use("android.app.ActivityThread").currentApplication().getApplicationContext();
  packageName = context.getPackageName();
}

//获取内存中所有activity
function getActivities() {
  const GET_ACTIVITIES = 0x00000001;
  var PackageManager = context.getPackageManager();
  const packageInfo = PackageManager.getPackageInfo(packageName, GET_ACTIVITIES);
  //获取全部的activities
  const activityInfos = packageInfo.activities.value.map((activityInfo) => {
      const activityName = activityInfo.name.value;
      if(pageSwitchMap[activityName]){
          pageSwitchMap[activityName]["LaunchMode"].add(activityInfo.launchMode.value);//启动模式
          pageSwitchMap[activityName]["Exported"].add(activityInfo.exported.value);//导出模式
          let permissions;
          if (activityInfo.permissions) {
              permissions = activityInfo.permissions.map((perm) => perm.name.value);
          } else {
              permissions = [];
          }
          pageSwitchMap[activityName]["Permissions"].add(permissions);//权限
      }
  });
}

// 定义函数R，用于获取安卓应用中指定资源的标识符
function R(name, type) {
  // 通过上下文对象获取资源管理对象Resources，并调用getIdentifier方法来获取指定资源的标识符
  return context.getResources().getIdentifier(name, type, packageName);
}


function checkForegroundActivityChange(currentActivity) {
  if (currentActivity && currentActivity!== lastForegroundActivity) {
      // 打印页面变化
      console.Blue(lastForegroundActivity);
      console.Yellow("        ======> " + currentActivity);
      
      if (!pageSwitchMap[lastForegroundActivity]) {
          pageSwitchMap[lastForegroundActivity] = {
              "Permissions":new Set(),    /*权限 */
              "LaunchMode":new Set(),     /*启动模式 */
              "Exported":new Set(),       /*导出属性 */
              "Switch": new Set()         /*跳转 */
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
      
      //补充填入activities信息
      getActivities();

      // 将页面跳转关系对象转换为符合要求的格式的对象（将Set转换为数组）
      const formattedPageSwitchMap = {};
      for (const key in pageSwitchMap) {
          formattedPageSwitchMap[key] = {
              "Switch": Array.from(pageSwitchMap[key]["Switch"]),
              "Permissions": Array.from(pageSwitchMap[key]["Permissions"]),
              "LaunchMode": Array.from(pageSwitchMap[key]["LaunchMode"]),
              "Exported": Array.from(pageSwitchMap[key]["Exported"])
          };
      }
      
      // 转换为JSON字符串并打印（可改为写入文件等操作）
      const historyJson = JSON.stringify(formattedPageSwitchMap);
      console.Blue("Switch(JSON):");
      console.log(historyJson);

      //重新计算
      startTime = Date.now();
      lastForegroundActivity = GetNowActivityName();//初始化
      pageSwitchMap = {};
  }
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


function main(){
  console.Purple("==================Exec Start==================");
  getContextPackageName();
  startTime = Date.now();
  lastForegroundActivity = GetNowActivityName();//初始化

  //hook activity启动
  Java.perform(function(){
    Java.use(class_method).performLaunchActivity.implementation = function(r,customIntent){
      var activity = this.performLaunchActivity(r,customIntent);
      //通过activity实例获取信息
      console.Blue(activity.getApplication()); //拿到Application
      checkForegroundActivityChange(activity.getIntent().getComponent().getClassName());
      return activity;
    }
  })
}

setImmediate(main);
