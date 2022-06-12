// ==UserScript==
// @name                    Save Pixiv Pictures to Eagle
// @name:zh                 下载Pixiv图片到Eagle
// @name:zh-CN              下载Pixiv图片到Eagle
// @description             Collect pictures in pixiv to eagle.
// @description:zh-CN       可通过油猴插件提供的按键修改部分功能设置。在Pixiv上添加可以导入图片到Eagle的下载按钮，默认保存所有标签以及标签翻译，以创作者名创建文件夹保存，能力有限暂无法处理动图。首页、排行榜、关注用户新作品页、收藏页添加下载按钮，添加复选框。自动将用户id添加进文件夹注释，同名文件夹注释中不存在id则更新注释添加id，尽量避免添加进同名不同id文件夹中。可批量下载全部作品和收藏。
// @description:zh          可通过油猴插件提供的按键修改部分功能设置。在Pixiv上添加可以导入图片到Eagle的下载按钮，默认保存所有标签以及标签翻译，以创作者名创建文件夹保存，能力有限暂无法处理动图。首页、排行榜、关注用户新作品页、收藏页添加下载按钮，添加复选框。自动将用户id添加进文件夹注释，同名文件夹注释中不存在id则更新注释添加id，尽量避免添加进同名不同id文件夹中。可批量下载全部作品和收藏。

// @namespace               https://github.com/miracleXL/scripts-for-Eagle
// @downloadURL             https://greasyfork.org/scripts/419792-save-pixiv-pictures-to-eagle/code/Save%20Pixiv%20Pictures%20to%20Eagle.user.js
// @updateURL               https://greasyfork.org/scripts/419792-save-pixiv-pictures-to-eagle/code/Save%20Pixiv%20Pictures%20to%20Eagle.user.js
// @icon		            https://www.pixiv.net/favicon.ico
// @version                 0.6.0
// @author                  miracleXL
// @match                   https://www.pixiv.net/*
// @connect                 localhost
// @connect                 www.pixiv.net
// @grant                   GM_xmlhttpRequest
// @grant                   GM_registerMenuCommand
// @grant                   GM_setValue
// @grant                   GM_getValue
// @grant                   GM_addElement
// @require                 https://code.jquery.com/jquery-3.5.1.min.js
// ==/UserScript==

// 更新内容：
// 修复：若先打开网页，后启动eagle，会导致未能及时获取软件信息带来的一系列问题；
// 新增：批量下载画师全部作品的功能（有bug待测试）；批量下载收藏（同左）
// 代码：整理了主函数逻辑；修改了下载列表的数据结构；修改了引用代码，增加了同时找到多个元素时仅回调一次的功能

// 更新设置项
// 不再使用！！请在打开pixiv的网页后，点击油猴插件，再点击本脚本下面的“更新设置”，在网页中添加的设置页面中修改并保存。后续更新将不会再清空设置
const PATT = / *[@＠◆■◇☆⭐️🌟🦇💎🔞🍅🌱🐻🍬：:\\\/].*/; // 处理作者名多余后缀的正则
const SAVE_TAGS = true; // 是否保存标签
const TAG_AUTHOR = true; // 是否将作者名加入标签
const ADD_TO_FAVOR = true; // 下载时是否同时加入收藏
const DL_Multiple = true; // 通过缩略图下载时，下载多P
const SEARCH_DIR_NAME = ""; // 在需要创建新文件夹时，新建文件夹的父文件夹名，在引号内输入文件夹名。留空则直接创建
const SEARCH_DIR_ID = ""; // 一般无需填写，上一行所指定文件夹的id（eagle中选中文件夹右键复制链接，获得如‘eagle://folder/K4130PELEY5W9’字符串，文件夹id就是其中K4130PELEY5W9部分）。填写会忽略上一行设置，可用来设置新建文件夹创建到某个子文件夹中。
const USE_CHECK_BOX = true; // 为true时在每一张图上添加复选框代替下载键，此时下载键将移至图片所在区域上方标题处
// 设置项结束

// 读取已存储设置
var patt = new RegExp(GM_getValue("patt", PATT.source));
var saveTags = GM_getValue("saveTags", SAVE_TAGS);
var tagAuthor = GM_getValue("tagAuthor", TAG_AUTHOR);
var addToFavor = GM_getValue("addToFavor", ADD_TO_FAVOR);
var DLMultiple = GM_getValue("DLMultiple", DL_Multiple);
var searchDirName = GM_getValue("searchDirName", SEARCH_DIR_NAME);
var searchDirId = GM_getValue("searchDirId", SEARCH_DIR_ID);
var useCheckbox = GM_getValue("useCheckbox", USE_CHECK_BOX);
// 读取结束
// 尝试避免正则保存错误带来的后果
if(patt.source === "[object Object]"){
    patt = new RegExp(PATT);
    GM_setValue("patt", patt.source);
}

// Eagle支持不同功能的版本号
const edit_folder_info = 20210401; // 支持修改文件夹信息的版本build号
const create_child_folder = 20210806; // 支持创建子文件夹的版本build号

// 各种页面元素JQuery选择器
const PAGE_SELECTOR = "div[type=illust] .sc-rp5asc-0"; // Pixiv首页及用户页图片选择器
const NIGHT_MODE = "#gtm-var-theme-kind" // 夜间模式
const BUTTON_SELECTOR = ".sc-7zddlj-1"; // 使用添加选择框的方式时的下载按钮位置
const NEW_ILLUST_BUTTON = ".sc-192ftwf-0"; // 新作品页按键位置
const RANK_PAGE_BUTTON = "nav.column-menu"; // 排行榜按键位置
const DL_ILLUST_BUTTON = ".sc-iasfms-2"; // 不使用复选框时，下载单张图片的按键位置
const SHOW_ALL = "a.sc-d98f2c-0.sc-s46o24-1" // 用户页面显示全部图片的按键位置
const NEXT_PAGE = ".kKBslM" // 用户artwork页面翻页按键位置

// 收藏页
const BOOKMARKS_BUTTON = "div.sc-1u8zqt7-0"; // 管理收藏按键
const BDL_BUTTON_POS = "div.sc-13ywrd6-4"; // 管理收藏中下载按键位置
const OVER_BUTTON = ".sc-1ij5ui8-0"; // 管理收藏结束按键
const BOOKMARK_SELECT = "div[type=illust]"; // 管理收藏页图片选择器
const SELECT_URL = "span:first";
const SELECT_CHECK = "input.sc-8ggyxi-4";

// 作品详细页面
const BUTTON_POS = ".sc-181ts2x-0"; // 下载按键位置
const PIC_SRC = ".sc-1qpw8k9-3"; // 图片位置
const SHOW_ALL_BUTTON = ".sc-emr523-0"; // 多图时显示全部的按键
const PIC_END = ".gtm-illust-work-scroll-finish-reading" // 展开多图时结束元素
const UGO_SRC = ".sc-tu09d3-1"; // 动图
const TAG_SELECTOR = ".sc-pj1a4x-1"; // 标签和标签翻译
const AUTHOR = ".sc-10gpz4q-6"; // 作者

const HEADERS = {
    "referer": "https://www.pixiv.net/",
    "sec-fetch-dest": "image",
    "sec-fetch-mode": "no-cors",
    "sec-fetch-site": "cross-site",
};

// Eagle API 服务器位置
const EAGLE_SERVER_URL = "http://localhost:41595";
const EAGLE_APP_INFO_URL = `${EAGLE_SERVER_URL}/api/application/info`;
const EAGLE_IMPORT_API_URL = `${EAGLE_SERVER_URL}/api/item/addFromURL`;
const EAGLE_IMPORT_API_URLS = `${EAGLE_SERVER_URL}/api/item/addFromURLs`;
const EAGLE_CREATE_FOLDER_API_URL = `${EAGLE_SERVER_URL}/api/folder/create`;
const EAGLE_UPDATE_FOLDER_API_URL = `${EAGLE_SERVER_URL}/api/folder/update`;
const EAGLE_GET_FOLDERS_API_URL = `${EAGLE_SERVER_URL}/api/folder/list`;


// 全局变量
var folders = [];
var folders_need_create = []; // {author, pid}
var download_list = {}; // {url: {data, author, authorId}}
var build_ver = ""; // Eagle build version
var run_mode = "else"; // "else" || "image" || "manga" || "ugoira" 
var dark_mode = $(NIGHT_MODE).textContent === "dark";

(function(){
    'use strict';

    if (location.href.indexOf("pixiv.net") === -1) {
        console.log("This script only works on pixiv.net.");
        return;
    }

    function checkEagleStatus(){
        if (build_ver != "") return;
        // 获取应用版本
        GM_xmlhttpRequest({
            url: EAGLE_APP_INFO_URL,
            method: "GET",
            onload: function(response) {
                if(response.statusText !== "OK"){
                    console.log(`请检查eagle是否打开！`);
                    console.log(response);
                    alert("下载失败！")
                }
                else{
                    build_ver = JSON.parse(response.response).data.buildVersion;
                }
            }
        });
        // 获取文件夹列表
        GM_xmlhttpRequest({
            url: EAGLE_GET_FOLDERS_API_URL,
            method: "GET",
            redirect:'follow',
            onload: function(response) {
                if(response.status !== 200){
                    alert(`请检查eagle是否打开！`);
                    reject();
                }
                folders = JSON.parse(response.response).data;
            }
        });
    }

    // 侦听URL是否发生变化，代码来自 https://blog.csdn.net/liubangbo/article/details/103272393
    let _wr = function(type) {
        var orig = history[type];
        return function() {
            var rv = orig.apply(this, arguments);
            var e = new Event(type);
            e.arguments = arguments;
            window.dispatchEvent(e);
            return rv;
        };
    };
    history.pushState = _wr('pushState');
    history.replaceState = _wr('replaceState')
    window.addEventListener('replaceState', function(e) {
        main();
    });
    window.addEventListener('pushState', function(e) {
        main();
    });

    main();

    var waitingForRun; // URL发生变化时，在新页面调用的函数

    function main(){
        if (waitingForRun){
            waitingForRun();
            waitingForRun = undefined;
        }
        // 先处理还未完成改版的旧页面和一些特殊情况
        if(document.URL.startsWith("https://www.pixiv.net/bookmark_new_illust.php")){
            // 关注用户新作品
            waitForKeyElements(NEW_ILLUST_BUTTON, newIllustPage, true);
        }
        else if(document.URL.startsWith("https://www.pixiv.net/ranking.php")){
            // 排行榜
            waitForKeyElements(".ranking-image-item", (element)=>{
                element.before(createCheckbox());
            }, false);
            rankingPage();
        }
        else if (document.URL.startsWith("https://www.pixiv.net/users/")){
            // 用户主页通用
            waitForKeyElements(BUTTON_SELECTOR, userPage, true, undefined, true);
            // // 收藏页面
            // if(document.URL.search("bookmarks") !== -1){
            //     waitForKeyElements(BOOKMARKS_BUTTON, bookmarksPage, true);
            // }
        }

        // 新版页面
        waitForKeyElements(BUTTON_POS, setMode, false); // artwork/** 图片详情页面
        waitForKeyElements("section", newPageCommon, false); // 通用样式
        if(useCheckbox){
            // 为所有图片添加复选框，但是不一定有对应的下载按键
            waitForKeyElements(PAGE_SELECTOR, (elem)=>{
                elem.prepend(createCheckbox());
            }, false);
        }
    }

    function download(data){
        // console.log(data);
        if(!data) return;
        GM_xmlhttpRequest({
            url: EAGLE_IMPORT_API_URL,
            method: "POST",
            data: JSON.stringify(data),
            onload: function(response) {
                if(response.statusText !== "OK"){
                    console.log(`请检查eagle是否打开！`);
                    console.log(response);
                    console.log(data);
                    alert("下载失败！")
                }
            }
        });
    }

    async function downloadList(){
        if (build_ver === ""){
            alert(`请检查eagle是否打开！`);
            return;
        }
        // return console.log(download_list);
        console.log(`需要创建文件夹：${folders_need_create.length}`)
        for(let folder of folders_need_create){
            console.log(folder);
            await creatFolder(folder.author, folder.pid);
        }
        console.log("文件夹创建完成！开始下载");
        for(let url in download_list){
            for (let data of download_list[url]){
                // console.log(data); /* {data|item, author, authorId} */
                getFolderId(data.author, data.authorId).then((dlFolderId)=>{
                    if(dlFolderId === undefined){
                        console.log("创建文件夹失败！尝试直接下载……")
                    }
                    else{
                        data.item.folderId = dlFolderId;
                    }
                    download(data.item);
                });
            }
        }
        download_list = {};
        folders_need_create = [];
    }

    function downloadAll(data){
        // console.log(data);
        if(!data || data.length === 0) return;
        GM_xmlhttpRequest({
            url: EAGLE_IMPORT_API_URLS,
            method: "POST",
            data: JSON.stringify(data),
            onload: function(response) {
                if(response.statusText !== "OK"){
                    alert("下载失败！");
                    console.log(`请检查eagle是否打开！`);
                    console.log(response);
                }
            }
        });
    }

    // 网站改版后页面通用样式
    function newPageCommon(element){
        if(useCheckbox){
            let [button1, button2, button3] = createThreeButtons(element);
            $(BUTTON_SELECTOR, element).append(button1);
            $(BUTTON_SELECTOR, element).append(button2);
            $(BUTTON_SELECTOR, element).append(button3);
        }else{
            waitForKeyElements(PAGE_SELECTOR,(elem)=>{
                elem.find(DL_ILLUST_BUTTON).append(addDownloadButton());
            }, true);
        }
    }

    // 收藏页面
    function bookmarksPage(element){
        $(".sc-1dg0za1-7", element).text("下载/管理收藏")
        function bookmarkAppendButton(){
            let button = document.createElement("div");
            button.className = "sc-1ij5ui8-0 QihHO sc-13ywrd6-7 tPCje";
            button.setAttribute("aria-disabled", "false");
            button.setAttribute("role", "button");
            dark_mode = $(NIGHT_MODE).text() === "dark";
            if(dark_mode){
                button.innerHTML='<div aria-disabled="false" class="sc-4a5gah-0 hCTOkT"><div class="sc-4a5gah-1 kHyYuA">下载</div></div>';
            }
            else{
                button.innerHTML='<div aria-disabled="false" class="sc-4a5gah-0 bmIdgb"><div class="sc-4a5gah-1 kHyYuA">下载</div></div>';
            }
            button.addEventListener("click", ()=>{
                if (build_ver === ""){
                    checkEagleStatus();
                }
                let count = $(BOOKMARK_SELECT).length;
                $(BOOKMARK_SELECT).each((index, elem)=>{
                    let e = $(SELECT_CHECK, elem)[0];
                    if(e && e.checked){
                        addToDownloadList("https://www.pixiv.net" + $(SELECT_URL, elem).attr("to"), DLMultiple).then(()=>{
                            if(--count === 0){
                                downloadList();
                            }
                        });
                        e.checked = false;
                    }
                    else if(--count === 0){
                        downloadList();
                    }
                })
            });
            $(BDL_BUTTON_POS).append(button);
            $(PAGE_SELECTOR+":first").click();
            $(PAGE_SELECTOR+":first").click();
            $(OVER_BUTTON+":last").click(()=>{
                waitForKeyElements(BOOKMARKS_BUTTON, bookmarksPage, true);
            });
        }
        element.click(()=>{
            setTimeout(bookmarkAppendButton, 10);
        })
    }

    // 关注用户新作品页
    function newIllustPage(){
        if(useCheckbox){
            let element = $("section");
            let [button1, button2, button3] = createThreeButtons(element);
            $(NEW_ILLUST_BUTTON).append(button1);
            $(NEW_ILLUST_BUTTON).append(button2);
            $(NEW_ILLUST_BUTTON).append(button3);
        }
        $(PAGE_SELECTOR).each((index, elem)=>{
            if(useCheckbox){
                elem.parentElement.append(createCheckbox());
            }else{
                elem.append(addDownloadButton());
            }
        })
    }

    // 用户作品页
    function userPage(){
        // userId = document.URL.split("/")[4];
        let page = document.URL.split("/")[5]?.split("?")[0];
        let pageCount = document.URL.split("=")[1];
        let button;
        if (page === "request" || page === "artworks"){
            button = createCommonButton("下载全部作品");
        }
        else if (page === "illustrations"){
            button = createCommonButton("下载全部插画");
        }
        else if (page === "manga"){
            button = createCommonButton("下载全部漫画");
        }
        else if (page === "bookmarks"){
            button = createCommonButton("下载全部作品");
            waitForKeyElements(BOOKMARKS_BUTTON, bookmarksPage, true);
            waitForKeyElements(".button_to_eagle", (e)=>{e.css("display", "none")}, true);
            waitForKeyElements(".to_eagle", (e)=>{e.parent().css("display", "none")}, true);
        }
        else{
            // console.log("error:", page)
            return;
        }
        let section = $("section")[0];
        function waitForPageLoaded(lastFirst){
            let timeControl = setInterval(()=>{
                let tmp = $(".to_eagle");
                let nextpage = $(NEXT_PAGE)[1];
                if ((tmp.length == 48 || (nextpage.hidden && tmp.length > 0)) && tmp[0] != lastFirst){
                    addAllArtToList(tmp);
                    clearInterval(timeControl);
                }
            }, 500);
        }
        function addAllArtToList(elements){
            // let count = $(".to_eagle", section).length;
            let count = elements.length;
            console.log("从", document.URL,"获取到", count, "个作品链接");
            // if (count < 48){
            //     console.log("当前页面疑似未能加载完成，请之后手动下载……");
            // }
            // $(".to_eagle").each((i,e)=>{
            elements.each((i,e)=>{
                // return console.log(e.parentElement.nextElementSibling.href);
                addToDownloadList(e.parentElement.nextElementSibling.href, true).then(()=>{
                    if(--count === 0){
                        let nextpage = $(NEXT_PAGE)[1];
                        if (nextpage.hidden){
                            console.log("当前筛选条件共有", $("span", $(BUTTON_SELECTOR)).text(), "个目标，实际获取到", Object.keys(download_list).length, "个");
                            // return console.log(download_list)
                            downloadList();
                        }
                        else{
                            nextpage.click();
                            // waitForKeyElements(".to_eagle", addAllArtToList, true, undefined, true);
                            waitForPageLoaded(elements[0]);
                        }
                    }
                });
            });
        }
        button.addEventListener("click", ()=>{
            if (build_ver == ""){
                checkEagleStatus();
            }
            if (!confirm("该操作将下载当前筛选结果中的全部内容，下载过程中会自动翻页，确认继续？")) return;
            if (page === undefined){
                // $(".to_eagle", section).data ('alreadyFound', true);
                $(SHOW_ALL)[0].click();
                // waitingForRun = ()=>{button.click()};
                // return;
            }
            else if(pageCount && pageCount != "1"){
                // $(".to_eagle").data ('alreadyFound', true);
                $(".kHhIF")[0].click();
            }
            // waitForKeyElements(".to_eagle", addAllArtToList, true, undefined, true);
            waitForPageLoaded();
            button.style.color = "rgb(0 150 250 / 70%)";
        });
        $(BUTTON_SELECTOR, section).append(button);
    }

    // 排行榜
    function rankingPage(){
        if(document.URL.search("content=ugoira") !== -1){
            return;
        }
        let pos = document.createElement("ul");
        pos.className = "menu-items";
        let button1 = document.createElement("li");
        button1.innerHTML = '<a style="cursor: pointer;color: #258fb8;padding: 10px;background: none;border: none;">全选</a>';
        let button2 = document.createElement("li");
        button2.innerHTML = '<a style="cursor: pointer;color: #258fb8;padding: 10px;background: none;border: none;">取消</a>';
        let button3 = document.createElement("li");
        button3.innerHTML = '<a style="cursor: pointer;color: #258fb8;padding: 10px;background: none;border: none;">下载</a>';
        button1.addEventListener("click", ()=>{
            $(".to_eagle").each((i,e)=>{
                e.checked = true;
            });
        });
        button2.addEventListener("click", ()=>{
            $(".to_eagle").each((i,e)=>{
                e.checked = false;
            });
        });
        button3.addEventListener("click", ()=>{
            if (build_ver === ""){
                checkEagleStatus();
            }
            let count = $(".to_eagle").length;
            $(".to_eagle").each(async (i,e)=>{
                if(e.checked){
                    addToDownloadList(e.parentElement.nextElementSibling.firstElementChild.href).then(()=>{
                        if(--count === 0){
                            downloadList();
                        }
                    });
                    e.checked = false;
                }
                else if(--count === 0){
                    downloadList();
                }
            });
            $("button",button3).css("color", "black");
        });
        pos.appendChild(button1);
        pos.appendChild(button2);
        pos.appendChild(button3);
        $(RANK_PAGE_BUTTON)[0].append(pos);
    }

    // 图片详情页
    function setMode(){

        // 单图
        function imagePage(){
            run_mode = "image";
            function getImageData(){
                let image = document.getElementsByClassName("sc-1qpw8k9-3")[0];// 单图
                if(!image){
                    alert("下载失败！");
                    return;
                }
                let [name, annotation, tags, author, id] = getCommonInfo();
                let data = {
                    "url": image.href,
                    "name": name,
                    "website": document.URL,
                    "tags": tags,
                    "annotation": annotation,
                    "headers": HEADERS
                }
                return [data, author, id];
            };

            let pos = $(BUTTON_POS);
            if(pos.length === 0) return;
            let button = createNormalButton("下载");
            pos[0].appendChild(button);
            button.addEventListener("click", async function(){
                if (build_ver === ""){
                    checkEagleStatus();
                }
                //下载同时自动点赞+收藏
                if(addToFavor){
                    try{
                        document.getElementsByClassName("_35vRH4a")[0].click();
                        document.getElementsByClassName("gtm-main-bookmark")[0].click();
                    }catch(e){}
                }
                let [data, author, id] = getImageData();
                let dlFolderId = await getFolderId(author, id);
                if(dlFolderId === undefined){
                    console.log("创建文件夹失败！尝试直接下载……")
                }
                else{
                    data.folderId = dlFolderId;
                }
                download(data);
                changeStyle(button);
            });
        }

        // 多图
        function mangaPage(){
            run_mode = "manga";
            function getImagesData(){
                let images = $(PIC_SRC);
                if(images.length === 0){
                    alert("下载失败！");
                    return [null, null];
                }
                let data = {"items":[]};
                let [name, annotation, tags, author, id] = getCommonInfo();
                images.each((index, url) => {
                    if(url === undefined) return;
                    data.items.push({
                        "url": url.href,
                        "name": name + `_${index}`,
                        "website": document.URL,
                        "annotation": annotation,
                        "tags": tags,
                        "headers": HEADERS
                    });
                    index++;
                });
                return [data,author, id];
            };
            
            function getSelectData(){
                let checkbox = $(".to_eagle");
                let [name, annotation, tags, author, id] = getCommonInfo();
                let data = {"items":[]};
                checkbox.each((index, element)=>{
                    if(element.checked === true){
                        data.items.push({
                            "url": element.parentElement.nextElementSibling.href,
                            "name": name + `_${index}`,
                            "website": document.URL,
                            "annotation": annotation,
                            "tags": tags,
                            "headers": HEADERS
                        })
                    }
                });
                return [data, author, id];
            };

            let pos = $(BUTTON_POS);
            if(pos.length === 0) return;
            let button = createNormalButton("下载");
            pos[0].appendChild(button);
            //绑定点击按钮时下载事件
            button.addEventListener("click", async () => {
                if (build_ver === ""){
                    checkEagleStatus();
                }
                //下载同时自动点赞+收藏
                if(addToFavor){
                    try{
                        document.getElementsByClassName("_35vRH4a")[0].click();
                        document.getElementsByClassName("gtm-main-bookmark")[0].click();
                    }catch(e){}
                }
                let [data, author, id] = getImagesData();
                let dlFolderId = await getFolderId(author, id);
                if(dlFolderId === undefined){
                    console.log("创建文件夹失败！尝试直接下载……");
                }
                else{
                    data.folderId = dlFolderId;
                }
                downloadAll(data);
                changeStyle(button);
            });
            let added = false;
            function changeButton(){
                console.log("changed")
                if(added) return;
                added = true;
                $("span",button)[0].innerText = "下载全部";
                let button2 = createNormalButton("下载选择");
                pos[0].appendChild(button2);
                button2.addEventListener("click", async () => {
                    let [data, author, id] = getSelectData();
                    let dlFolderId = await getFolderId(author, id);
                    if (dlFolderId === undefined) {
                        console.log("创建文件夹失败！尝试直接下载……");
                    }
                    else {
                        data.folderId = dlFolderId;
                    }
                    downloadAll(data);
                    changeStyle(button2);
                });

                function addMangaCheckbox(){
                    let imgs = $(PIC_SRC);
                    imgs.each((index,element)=>{
                        element.before(createCheckbox());
                    });
                }            
                waitForKeyElements(PIC_END, addMangaCheckbox, true);
            }
            let clickpos = $(PIC_SRC);
            if(clickpos.length !== 0){
                clickpos[0].addEventListener("click",changeButton)
            }
            clickpos = $(SHOW_ALL_BUTTON);
            if(clickpos.length !== 0){
                clickpos[0].addEventListener("click",changeButton)
            }
            clickpos = $(".gtm-main-bookmark");
            if(clickpos.length !== 0){
                clickpos[0].addEventListener("click",changeButton)
            }
        }

        // 动图
        function ugoiraPage(){
            run_mode = "ugoira";
            console.log("暂无法处理动图！")
        }

        function changeStyle(button){
            button.className = "_1vHxmVH _35vRH4a";
        }

        function createNormalButton(text){
            let button = document.createElement('div');
            button.setAttribute('class', 'sc-181ts2x-01');
            button.setAttribute('style', 'margin-right: 23px;');
            button.innerHTML = `<button type="button" id="download" class="_35vRH4a"><span class="_3uX7m3X">${text}</span></button>`;
            return button;
        }

        if($(UGO_SRC).length !== 0){
            return ugoiraPage();
        }
        if($(SHOW_ALL_BUTTON).length !== 0){
            return mangaPage();
        }
        return imagePage();
    };

    // 获取文件夹id
    async function getFolderId(author, pid){
        // 搜索同名或注释中包含有pid信息的文件夹
        function searchFolder(folders, author, pid){
            for(let folder of folders){
                let description = folder.description;
                description = description ? description.match(/(?<=pid ?[:=] ?)\d+/) : "";
                if((description && description[0] === pid) || folder.name === author){
                    if(description){
                        if(description[0] !== pid){
                            continue;
                        }
                    }
                    else{
                        let d = "";
                        for(let s of folder.description.split("\n")){
                            if(!/^ *pid ?[:=] ?/.test(s)){
                                d += "\n" + s;
                            }
                        }
                        updateFolder({
                            "folderId": folder.id,
                            "newDescription":`pid = ${pid}${d}`
                        })
                    }
                    return folder;
                }
            }
            for(let folder of folders){
                let target = searchFolder(folder.children, author, pid);
                if(target) return target;
            }
        }
    
        if(!pid){
            console.log("获取用户id失败！");
        }
        if(!author && !pid) return;
        let dlFolder;
        if(folders){
            if(searchDirName === ""){
                dlFolder = searchFolder(folders, author, pid);
            }
            else{
                for(let folder of folders){
                    if(folder.name === searchDirName){
                        if(searchDirId === ""){
                            searchDirId = folder.id;
                        }
                        // console.log(searchDirId);
                        dlFolder = searchFolder(folder.children, author, pid);
                    }
                    else{
                        let description = folder.description?.match(/(?<=pid ?[:=] ?)\d+/);
                        if((description && description[0] === pid) || folder.name === author){
                            if(description){
                                if(description[0] !== pid){
                                    continue;
                                }
                            }
                            else{
                                let d = "";
                                for(let s of description.split("\n")){
                                    if(!/^ *pid ?[:=] ?/.test(s)){
                                        d += "\n" + s;
                                    }
                                }
                                updateFolder({
                                    "folderId": folder.id,
                                    "newDescription":`pid = ${pid}${d}`
                                })
                            }
                            dlFolder = folder;
                            break;
                        }
                    }
                }
            }
        }
        else{
            console.log("获取文件夹信息失败！");
            alert("下载失败！");
            return;
        }
        if(!dlFolder){
            if(run_mode == "else"){
                if(folders_need_create){
                    for(let f of folders_need_create){
                        if(f.pid === pid){
                            return undefined;
                        }
                    }
                }
                folders_need_create.push({author,pid});
                return undefined;
            }
            else{
                dlFolder = await creatFolder(author, pid);
            }
        }
        return dlFolder.id;
    }

    // 创建文件夹
    function creatFolder(folderName, pid){
        if (build_ver == ""){
            checkEagleStatus();
        }
        return new Promise((resolve, reject) => {
            if(searchDirId === ""){
                searchDirId = undefined;
            }
            GM_xmlhttpRequest({
                url: EAGLE_CREATE_FOLDER_API_URL,
                method: "POST",
                data: JSON.stringify({ folderName: folderName, parent: searchDirId }),
                onload: function(response) {
                    var result = JSON.parse(response.response);
                    if (result.status === "success" && result.data && result.data.id) {
                        updateFolder({
                            "folderId":result.data.id,
                            "newDescription":`pid = ${pid}`
                        });
                        folders.push({
                            id: result.data.id,
                            name: folderName,
                            description: `pid = ${pid}`
                        });
                        console.log(folders);
                        return resolve(result.data);
                    }
                    else{
                        console.log(`请检查eagle是否打开！`);
                        alert("文件夹创建失败！");
                        return reject();
                    }
                }
            })
        })
    }

    // 更新文件夹信息
    function updateFolder(data){
        if(Number(build_ver) < edit_folder_info){
            return;
        }
        GM_xmlhttpRequest({
            url: EAGLE_UPDATE_FOLDER_API_URL,
            method: "POST",
            data: JSON.stringify(data),
            onload: function(response) {
                if(response.statusText !== "OK"){
                    console.log(`请检查eagle是否打开！`);
                    console.log(response);
                    console.log(data);
                    alert("下载失败！");
                }
            }
        });
    }

    function getCommonInfo(){
        //获取标题
        let name = document.getElementsByClassName("sc-1u8nu73-3")[0];
        if(name === undefined){
            name = document.title;
        }else{
            name = name.textContent;
        }
        //获取描述(Eagle2.0版本以下因bug无法生效)
        let annotation = document.getElementById("expandable-paragraph-0");
        if(annotation){annotation = annotation.textContent;}
        else{annotation = "";}
        //把pixiv标签和标签翻译添加进eagle标签
        let tags = [];
        if(saveTags){
            $(TAG_SELECTOR).each((index,elem)=>{
                $("a", elem).each((i,tag)=>{
                    if(tag.textContent) tags.push(tag.textContent);
                })
            })
        }
        let author = $(AUTHOR).text();
        let id = $(AUTHOR).attr("data-gtm-value");
        // 删除多余后缀，为避免误伤，同时使用多种符号不作处理
        let test = author.match(patt);
        if(test && test.length === 1){
            let tmp = author.replace(test[0],"");
            author = tmp === "" ? author : tmp;
        }
        if(tagAuthor){
            tags.push(author);
        }
        return [name, annotation, tags, author, id];
    }

    function createCommonButton(text){
        let button = document.createElement('button');
        button.style.border = "none";
        button.style.background = "none";
        button.style.marginLeft = "20px";
        button.style.fontSize = "x-small";
        button.style.fontWeight = "bold";
        button.style.color = "gray";
        button.style.cursor = "pointer";
        button.innerText = text;
        return button;
    }

    // 创建全选、取消、下载三个按键
    function createThreeButtons(element){
        let button1 = createCommonButton("全选");
        let button2 = createCommonButton("取消");
        let button3 = createCommonButton("下载");
        button1.className = "button_to_eagle";
        button2.className = "button_to_eagle";
        button3.className = "button_to_eagle";
        button1.addEventListener("click", ()=>{
            $(".to_eagle", element).each((i,e)=>{
                e.checked = true;
            });
        });
        button2.addEventListener("click", ()=>{
            $(".to_eagle", element).each((i,e)=>{
                e.checked = false;
            });
        });
        button3.addEventListener("click", ()=>{
            if (build_ver == ""){
                checkEagleStatus();
            }
            let count = $(".to_eagle", element).length;
            $(".to_eagle", element).each((i,e)=>{
                if(e.checked){
                    addToDownloadList(e.parentElement.nextElementSibling.href).then(()=>{
                        if(--count === 0){
                            downloadList();
                        }
                    });
                    e.checked = false;
                }
                else if(--count === 0){
                    downloadList();
                }
            });
            button3.style.color = "rgb(0 150 250 / 70%)";
        });
        return [button1, button2, button3]
    }

    // 创建选择框
    function createCheckbox(){
        let input_container = document.createElement("div");
        let checkbox = document.createElement("input");
        checkbox.setAttribute("class","to_eagle");
        checkbox.setAttribute("type","checkbox");
        input_container.appendChild(checkbox);
        input_container.style.position = "absolute";
        input_container.style.zIndex = 3;
        input_container.style.display = "flex";
        input_container.style.backgroundColor = "rgba(0,0,0,.1)";
        input_container.style.padding = "9px";
        // input_container.className = "cb_div";
        return input_container;
    };

    // 创建每张图片上的下载图标
    function addDownloadButton(){
        let pos = document.createElement("div");
        pos.style.zIndex = 3;
        let button = document.createElement("button");
        pos.appendChild(button);
        button.setAttribute("class","dl_to_eagle iPGEIN");
        button.setAttribute("type", "button");
        button.setAttribute("title", "下载这张图到Eagle");
        button.style.backgroundColor = "rgba(0,0,0,.1)";
        button.style.border = "none";
        button.innerHTML = '<svg viewBox="0 0 120 120" style="width: 22px;height: 22px;stroke: white;fill: none;stroke-width: 10;"><polyline style="stroke: black; stroke-width: 15;" points="60,102 60,8"></polyline><polyline style="stroke: black; stroke-width: 15;" points="10,55 60,105 110,55"></polyline><polyline points="60,100 60,10"></polyline><polyline points="12,57 60,105 108,57"></polyline></svg>';
        button.addEventListener("click", ()=>{
            if (build_ver === ""){
                checkEagleStatus();
            }
            getImagePage(pos.parentElement.previousSibling.href).then(async (data /** item, author, authorId **/)=>{
                console.log(data)
                let dlFolderId = await getFolderId(data.author, data.authorId);
                if(dlFolderId === undefined){
                    console.log("创建文件夹失败！尝试直接下载……")
                }
                else{
                    data.item.folderId = dlFolderId;
                }
                download(data.item);
                $("svg", button)[0].style.stroke = "gray";
            });
        });
        return pos;
    }

    // 获取新页面并返回图片信息
    function getImagePage(url){
        return new Promise((resolve, reject)=>{
            let item = {
                "website": url,
                "tags": [],
                "headers": HEADERS
            };
            $.ajax({
                type: "GET",
                url: url,
                dataType: "html",
                success: async (data)=>{
                    try{
                        let html = $(data);
                        let preloadData = html.filter("#meta-preload-data")[0];
                        let illust = JSON.parse(preloadData.content)["illust"];
                        let id = Object.keys(illust)[0];
                        let illustData = illust[id];
                        item.url = illustData.urls.original;
                        item.name = illustData.title;
                        item.annotation = illustData.description;
                        for(let tag of illustData.tags.tags){
                            item.tags.push(tag.tag);
                            if(tag.translation){
                                for(let trans of Object.values(tag.translation)){
                                    item.tags.push(trans);
                                }
                            }
                        }
                        let author = illustData.userName || illustData.userAccount;
                        let authorId = illustData.userId;
                        let test = author.match(patt);
                        if(test && test.length === 1){
                            author = author.replace(test[0],"");
                        }
                        if(tagAuthor){
                            item.tags.push(author);
                        }
                        if(!authorId){
                            console.log("获取用户id失败！")
                            console.log(illustData);
                        }
                        resolve({item, author, authorId});
                    }
                    catch(e){
                        reject(e);
                    }
                }
            });
        });
    }

    // 获取新页面并返回所有图片信息
    function getImagesPage(url){
        return new Promise((resolve, reject)=>{
            $.ajax({
                type: "GET",
                url: url,
                dataType: "html",
                success: async (data)=>{
                    try{
                        let items = [];
                        let html = $(data);
                        let preloadData = html.filter("#meta-preload-data")[0];
                        let illust = JSON.parse(preloadData.content)["illust"];
                        let id = Object.keys(illust)[0];
                        let illustData = illust[id];
                        let item = {
                            "website": url,
                            "tags": [],
                            "headers": HEADERS
                        };
                        item.url = illustData.urls.original;
                        item.name = illustData.title;
                        item.annotation = illustData.description;
                        for(let tag of illustData.tags.tags){
                            item.tags.push(tag.tag);
                            if(tag.translation){
                                for(let trans of Object.values(tag.translation)){
                                    item.tags.push(trans);
                                }
                            }
                        }
                        let author = illustData.userName || illustData.userAccount;
                        let authorId = illustData.userId;
                        let test = author.match(patt);
                        if(test && test.length === 1){
                            author = author.replace(test[0],"");
                        }
                        if(tagAuthor){
                            item.tags.push(author);
                        }
                        if(!authorId){
                            console.log("获取用户id失败！")
                            console.log(illustData);
                        }
                        items.push({item, author, authorId});
                        let url0 = item.url.replace(/0\.[a-z]+/, "");
                        let suffix = item.url.match(/(?<=0)\.[a-z]+/);
                        for(let i = 1; i < illustData.pageCount; i++){
                            let item = {
                                "website": items[0].item.website,
                                "url": url0 + i + suffix,
                                "name": items[0].item.name,
                                "annotation": items[0].item.annotation,
                                "tags": items[0].item.tags,
                                "headers": items[0].item.headers
                            };
                            items.push({item, author, authorId});
                        }
                        resolve(items);
                    }
                    catch(e){
                        reject(e);
                    }
                }
            });
        });
    }


    // 为确保不反复创建文件夹，先将所有待下载数据保存到列表
    async function addToDownloadList(url, allPage = false){
        if (url in download_list) return;
        let data /* [{data, author, authorId}] */;
        if (allPage){
            data = await getImagesPage(url);
            getFolderId(data[0].author, data[0].authorId);
            // console.log(data);
            download_list[url] = data;
        }
        else{
            data = await getImagePage(url);
            getFolderId(data.author, data.authorId);
            download_list[url] = [data];
        }
    }
})();


// @require                 https://gist.github.com/raw/2625891/waitForKeyElements.js
// 因外部链接无法通过油猴检测，将源代码复制粘贴在这
// 进行了修改，添加了参数bCallOnce，为true时仅在选择元素出现时，调用一次actionFunction，不再为每个元素分别调用，且不再传回任何参数
/*--- waitForKeyElements():  A utility function, for Greasemonkey scripts,
    that detects and handles AJAXed content.

    Usage example:

        waitForKeyElements (
            "div.comments"
            , commentCallbackFunction
        );

        //--- Page-specific function to do what we want when the node is found.
        function commentCallbackFunction (jNode) {
            jNode.text ("This comment changed by waitForKeyElements().");
        }

    IMPORTANT: This function requires your script to have loaded jQuery.
*/
function waitForKeyElements (
    selectorTxt,            /* Required: The jQuery selector string that
                                specifies the desired element(s).
                            */
    actionFunction,         /* Required: The code to run when elements are
                                found. It is passed a jNode to the matched
                                element.
                            */
    bWaitOnce=false,        /* Optional: If false, will continue to scan for
                                new elements even after the first match is
                                found.
                            */
    iframeSelector=undefined,/* Optional: If set, identifies the iframe to
                                search.
                            */
    bCallOnce=false         // 修改添加参数，
) {
    var targetNodes, btargetsFound;

    if (typeof iframeSelector == "undefined")
        targetNodes     = $(selectorTxt);
    else
        targetNodes     = $(iframeSelector).contents ()
                                           .find (selectorTxt);

    if (targetNodes  &&  targetNodes.length > 0) {
        btargetsFound   = true;
        /*--- Found target node(s).  Go through each and act if they
            are new.
        */
        if(bCallOnce){
            var alreadyFound = targetNodes.data ('alreadyFound')  ||  false;

            if (!alreadyFound) {
                //--- Call the payload function.
                var cancelFound     = actionFunction ();
                if (cancelFound)
                    btargetsFound   = false;
                else
                    targetNodes.data ('alreadyFound', true);
            }
        }
        else{
            targetNodes.each ( function () {
                var jThis        = $(this);
                var alreadyFound = jThis.data ('alreadyFound')  ||  false;

                if (!alreadyFound) {
                    //--- Call the payload function.
                    var cancelFound     = actionFunction (jThis);
                    if (cancelFound)
                        btargetsFound   = false;
                    else
                        jThis.data ('alreadyFound', true);
                }
            } );
        }
    }
    else {
        btargetsFound   = false;
    }

    //--- Get the timer-control variable for this selector.
    var controlObj      = waitForKeyElements.controlObj  ||  {};
    var controlKey      = selectorTxt.replace (/[^\w]/g, "_");
    var timeControl     = controlObj [controlKey];

    //--- Now set or clear the timer as appropriate.
    if (btargetsFound  &&  bWaitOnce  &&  timeControl) {
        //--- The only condition where we need to clear the timer.
        clearInterval (timeControl);
        delete controlObj [controlKey]
    }
    else {
        //--- Set a timer, if needed.
        if ( ! timeControl) {
            timeControl = setInterval ( function () {
                    waitForKeyElements (    selectorTxt,
                                            actionFunction,
                                            bWaitOnce,
                                            iframeSelector,
                                            bCallOnce
                                        );
                },
                200
            );
            controlObj [controlKey] = timeControl;
        }
    }
    waitForKeyElements.controlObj   = controlObj;
}

GM_registerMenuCommand("更新设置", updateConfig);

function updateConfig(){
    let div = document.createElement("div");
    function createNewConfig(text, type, value){
        let p = document.createElement("p");
        let input = document.createElement("input");
        input.setAttribute("type", type);
        if(type === "text"){
            input.style.width = "100%";
            input.value = value;
            p.innerText = text;
            div.appendChild(p);
            div.appendChild(input);
        }
        else if(type === "checkbox"){
            input.style.marginLeft = "10px";
            input.checked = value;
            p.appendChild(input);
            p.append(text);
            div.appendChild(p);
        }
        return input;
    }
    // 布尔值
    let saveTags_input = createNewConfig("是否保存标签", "checkbox", saveTags);
    let tagAuthor_input = createNewConfig("是否将作者名加入标签", "checkbox", tagAuthor);
    let addToFavor_input = createNewConfig("下载时是否同时加入收藏", "checkbox", addToFavor);
    let useCheckbox_input = createNewConfig("使用复选框，而不是每张图添加下载按键", "checkbox", useCheckbox);
    let DLMultiple_input = createNewConfig("在收藏夹内下载时，下载多P", "checkbox", DLMultiple);
    // 文本
    let patt_input = createNewConfig("正则表达式，处理作者名多余后缀：", "text", patt.source);
    let searchDirName_input = createNewConfig("父文件夹名：\n（在需要创建新文件夹时，新建文件夹的父文件夹名，在引号内输入文件夹名。留空则直接创建）", "text", searchDirName);
    let searchDirId_input = createNewConfig("父文件夹id：\n（一般无需填写，填写会忽略上一行设置，可用来设置新建文件夹创建到某个子文件夹中。）\n（eagle中选中文件夹右键复制链接，获得如‘eagle://folder/K4130PELEY5W9’字符串，文件夹id就是其中K4130PELEY5W9部分）", "text", searchDirId);
    let button_save = document.createElement("button");
    let button_cancel = document.createElement("button");
    button_save.innerText = "保存";
    button_cancel.innerText = "取消";
    button_save.style.margin = "20px";
    button_cancel.style.margin = "20px";
    button_save.addEventListener("click", ()=>{
        saveTags = saveTags_input.checked;
        tagAuthor = tagAuthor_input.checked;
        addToFavor = addToFavor_input.checked;
        useCheckbox = useCheckbox_input.checked;
        DLMultiple = DLMultiple_input.checked;
        patt = new RegExp(patt_input.value);
        searchDirName = searchDirName_input.value;
        searchDirId = searchDirId_input.value;
        GM_setValue("patt", patt.source);
        GM_setValue("saveTags", saveTags);
        GM_setValue("tagAuthor", tagAuthor);
        GM_setValue("addToFavor", addToFavor);
        GM_setValue("searchDirName", searchDirName);
        GM_setValue("searchDirId", searchDirId);
        GM_setValue("useCheckbox", useCheckbox);
        GM_setValue("DLMultiple", DLMultiple);
        div.remove();
    });
    button_cancel.addEventListener("click",()=>{
        div.remove();
    });
    div.appendChild(button_save);
    div.appendChild(button_cancel);
    div.style.position = "fixed";
    div.style.width = "80%";
    div.style.top = "10%";
    div.style.left = "10%";
    div.style.padding = "15px";
    dark_mode = $(NIGHT_MODE).text() === "dark";
    div.style.background = dark_mode ? "black" : "white";
    document.body.appendChild(div);
}

