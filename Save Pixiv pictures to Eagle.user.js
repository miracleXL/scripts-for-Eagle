// ==UserScript==
// @name                    Save Pixiv Pictures to Eagle
// @name:zh                 下载Pixiv图片到Eagle
// @name:zh-CN              下载Pixiv图片到Eagle
// @description             Collect pictures in pixiv to eagle.
// @description:zh-CN       可根据需求自行修改代码中设置项。在Pixiv上添加可以导入图片到Eagle的下载按钮，默认保存所有标签以及标签翻译，以创作者名创建文件夹保存，能力有限暂无法处理动图。首页、关注用户新作品页、收藏页添加下载按钮，添加复选框。自动将用户id添加进文件夹注释，同名文件夹注释中不存在id则更新注释添加id，尽量避免添加进同名不同id文件夹中
// @description:zh          可根据需求自行修改代码中设置项。在Pixiv上添加可以导入图片到Eagle的下载按钮，默认保存所有标签以及标签翻译，以创作者名创建文件夹保存，能力有限暂无法处理动图。首页、关注用户新作品页、收藏页添加下载按钮，添加复选框。自动将用户id添加进文件夹注释，同名文件夹注释中不存在id则更新注释添加id，尽量避免添加进同名不同id文件夹中

// @namespace               https://github.com/miracleXL
// @icon		            https://www.pixiv.net/favicon.ico
// @version                 0.4.7
// @author                  miracleXL
// @match                   https://www.pixiv.net/*
// @connect                 localhost
// @connect                 www.pixiv.net
// @grant                   GM_xmlhttpRequest
// @grant                   GM_registerMenuCommand
// @require                 https://code.jquery.com/jquery-3.5.1.min.js
// @require                 https://greasyfork.org/scripts/2199-waitforkeyelements/code/waitForKeyElements.js?version=6349
// ==/UserScript==

// 注意！因收藏页的复选框影响了原网页正常功能，现已将下载按键合并入“管理收藏”的功能中！
// 似乎已经无影响了，小改动修复从收藏页跳转出去脚本不会执行的问题
// pixiv的网站前端仍在频繁更新中，脚本随时可能失效

(function(){
    'use strict';

    if (location.href.indexOf("pixiv.net") === -1) {
        console.log("This script only works on pixiv.net.");
        return;
    }

    // 设置项
    const patt = / *[@＠◆■◇☆⭐️🌟🦇💎🔞🍅🌱🐻🍬：:\\\/].*/; // 处理作者名多余后缀的正则
    const saveTags = true; // 是否保存标签
    const tagAuthor = true; // 是否将作者名加入标签
    const addToFavor = true; // 下载时是否同时加入收藏
    const searchDirName = ""; // 在判断是否需要创建文件夹时，限定搜索的范围，在引号内输入文件夹名，仅搜索该文件夹内和最外层，留空则搜索全部
    const enableNewIllust = true; // 关注用户新作品页面添加下载按钮
    const useCheckbox = true; // 为true时在每一张图上添加复选框代替下载键，此时下载键将移至图片所在区域上方标题处
    // 设置项结束

    //Pixiv页面中的标签和标签翻译
    const TAG_SELECTOR = ".pj1a4x-1.ePBhWV";
    // 页面图片选择器
    const PAGE_SELECTOR = "div[type=illust] .rp5asc-0"; // Pixiv首页及用户页
    const BUTTON_SELECTOR = ".sc-7zddlj-1.bfLCvR"; // 使用添加选择框的方式时的下载按钮位置
    const NEW_ILLUST_SELECTOR = ".thumbnail-menu"; // 关注用户新作品
    const NEW_ILLUST_BUTTON = ".column-menu"; // 新作品页按键位置
    // 收藏页
    const BOOKMARKS_BUTTON = "div.sc-1u8zqt7-0.hiKlBL.sc-1dg0za1-1.sc-1dg0za1-2"; // 管理收藏按键
    const BDL_BUTTON_POS = "div.sc-13ywrd6-4.cngkan"; // 管理收藏中下载按键位置
    const OVER_BUTTON = "div.sc-1ij5ui8-0.cBRwmk"; // 管理收藏结束按键
    const BOOKMARKS_SELECT = "div[type=illust]"
    const SELECT_URL = "span:first";
    const SELECT_CHECK = "input.sc-8ggyxi-4";
    // 作品详细页面
    const BUTTON_POS = ".sc-181ts2x-0.jPZrYy"; // 下载按键位置
    const PIC_SRC = ".sc-1qpw8k9-3"; // 图片位置
    const SHOW_ALL_BUTTON = ".emr523-0"; // 多图时显示全部的按键
    const PIC_END = ".gtm-illust-work-scroll-finish-reading" // 展开多图时结束元素
    const UGO_SRC = ".tu09d3-1.MNNrM"; // 动图
    const AUTHOR = ".sc-10gpz4q-6.hsjhjk > div:first-child"; // 作者名
    const AUTHOR_ID = ".sc-10gpz4q-6.hsjhjk"; // 作者id

    const HEADERS = {
        "referer": "https://www.pixiv.net/",
        "sec-fetch-dest": "image",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "cross-site",
    };

    // Eagle API 服务器位置
    const EAGLE_SERVER_URL = "http://localhost:41595";
    const EAGLE_IMPORT_API_URL = `${EAGLE_SERVER_URL}/api/item/addFromURL`;
    const EAGLE_IMPORT_API_URLS = `${EAGLE_SERVER_URL}/api/item/addFromURLs`;
    const EAGLE_CREATE_FOLDER_API_URL = `${EAGLE_SERVER_URL}/api/folder/create`;
    const EAGLE_UPDATE_FOLDER_API_URL = `${EAGLE_SERVER_URL}/api/folder/update`;
    const EAGLE_GET_FOLDERS_API_URL = `${EAGLE_SERVER_URL}/api/folder/list`;

    function main(){
        if(router()){
            return;
        }
        waitForKeyElements(BUTTON_POS, setMode, false); // artwork/** 图片详情页面
        waitForKeyElements("section", newPageCommon, false); // 通用样式
        waitForKeyElements(PAGE_SELECTOR, (elem)=>{
            elem.prepend(createCheckbox());
        }, false); // 为所有图片添加复选框，但是不一定有对应的下载按键
    }

    // 分情况处理
    function router(){
        if(enableNewIllust && document.URL.startsWith("https://www.pixiv.net/bookmark_new_illust.php")){
            waitForKeyElements(".x7wiBV0", newIllustPage, true);
            return false;
        }
        else if(document.URL.search("bookmarks") !== -1){
            waitForKeyElements(BOOKMARKS_BUTTON, bookmarksPage, true);
            return true;
        }
        return false;
    }

    // 网站改版后页面通用样式
    function newPageCommon(element){
        if(useCheckbox){
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
                $(".to_eagle", element).each((i,e)=>{
                    if(e.checked){
                        downloadNewPage(e.parentElement.nextElementSibling.href);
                    }
                });
            });
            $(BUTTON_SELECTOR, element).append(button1);
            $(BUTTON_SELECTOR, element).append(button2);
            $(BUTTON_SELECTOR, element).append(button3);
        }else{
            waitForKeyElements(PAGE_SELECTOR,(elem)=>{
                elem.find(".iasfms-2.gGOhDf").append(addDownloadButton());
            }, true);
        }
    }

    // 新收藏页面
    function bookmarksPage(element){
        $(".sc-1dg0za1-0", element).text("下载/管理收藏")
        element.click(()=>{
            setTimeout(bookmarkAppendButton, 10);
        })
    }

    // 关注用户新作品页
    function newIllustPage(){
        if(useCheckbox){
            let pos = document.createElement("ul");
            pos.className = "menu-items";
            let button1 = document.createElement("li");
            button1.innerHTML = '<button style="color: #258fb8;padding: 10px;background: none;border: none;">全选</button>';
            let button2 = document.createElement("li");
            button2.innerHTML = '<button style="color: #258fb8;padding: 10px;background: none;border: none;">取消</button>';
            let button3 = document.createElement("li");
            button3.innerHTML = '<button style="color: #258fb8;padding: 10px;background: none;border: none;">下载</button>';
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
                $(".to_eagle").each(async (i,e)=>{
                    if(e.checked){
                        downloadNewPage(e.parentElement.parentElement.firstElementChild.href);
                    }
                });
                $("button",button3).css("color", "black");
            });
            pos.appendChild(button1);
            pos.appendChild(button2);
            pos.appendChild(button3);
            $(NEW_ILLUST_BUTTON).append(pos);
        }
        $(NEW_ILLUST_SELECTOR).each((index, elem)=>{
            if(useCheckbox){
                elem.parentElement.append(createCheckbox());
            }else{
                elem.append(addDownloadButton());
            }
        })
    }

    // 图片详情页
    function setMode(){
        if($(UGO_SRC).length !== 0){
            return ugoiraPage();
        }
        if($(SHOW_ALL_BUTTON).length !== 0){
            return mangaPage();
        }
        return imagePage();
    };

    // 单图
    function imagePage(){
        let pos = $(BUTTON_POS);
        if(pos.length === 0) return;
        let button = createNormalButton("下载");
        pos[0].appendChild(button);
        button.addEventListener("click", async function(){
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
        let pos = $(BUTTON_POS);
        if(pos.length === 0) return;
        let button = createNormalButton("下载");
        pos[0].appendChild(button);
        //绑定点击按钮时下载事件
        button.addEventListener("click", async () => {
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
        console.log("暂无法处理动图！")
    }

    function download(data){
        // console.log(data);
        GM_xmlhttpRequest({
            url: EAGLE_IMPORT_API_URL,
            method: "POST",
            data: JSON.stringify(data),
            onload: function(response) {
                if(response.statusText !== "OK"){
                    console.log(`请检查eagle是否打开！`);
                    console.log(response);
                    alert("下载失败！")
                }
            }
        });
    }

    function downloadAll(data){
        // console.log(data);
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

    // 获取文件夹id
    async function getFolderId(author, pid){
        if(!pid){
            console.log("获取用户id失败！");
        }
        if(!author && !pid) return;
        let folders = await getFolders();
        let dlFolder;
        if(folders){
            if(searchDirName === ""){
                dlFolder = searchFolder(folders, author, pid);
                if(!dlFolder){
                    dlFolder = await creatFolder(author, pid);
                    updateFolder({
                        "folderId": dlFolder.id,
                        "newDescription": `pid = ${pid}`
                    })
                }
            }
            else{
                for(let folder of folders){
                    if(folder.name === searchDirName){
                        dlFolder = searchFolder(folder.children, author, pid);
                    }
                    else{
                        let description = folder.description.match(/(?<=pid ?[:=] ?)\d+/);
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
        return dlFolder.id;
    }

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

    // 获取文件夹
    function getFolders(){
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: EAGLE_GET_FOLDERS_API_URL,
                method: "GET",
                redirect:'follow',
                onload: function(response) {
                    if(response.status !== 200){
                        reject();
                    }
                    resolve(JSON.parse(response.response).data);
                }
            });
        })
    }

    // 创建文件夹
    function creatFolder(folderName, pid){
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: EAGLE_CREATE_FOLDER_API_URL,
                method: "POST",
                data: JSON.stringify({ folderName: folderName }),
                onload: function(response) {
                    var result = JSON.parse(response.response);
                    if (result.status === "success" && result.data && result.data.id) {
                        updateFolder({
                            "folderId":result.data.id,
                            "newDescription":`pid = ${pid}`
                        });
                        return resolve(result.data);
                    }
                    else{
                        return reject();
                    }
                }
            })
        })
    }

    // 更新文件夹信息
    function updateFolder(data){
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
                    tags.push(tag.textContent);
                })
            })
        }
        let author = $(AUTHOR).text();
        let id = $(AUTHOR_ID).attr("href").match(/\d+/)[0];
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

    function getImagesData(){
        let images = $(PIC_SRC);
        images = images.length === 0 ? $(PICS_SRC) : images;
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

    function createCommonButton(text){
        let button = document.createElement('button');
        button.style.border = "none";
        button.style.background = "none";
        button.style.marginLeft = "20px";
        button.style.fontSize = "x-small";
        button.style.fontWeight = "bold";
        button.style.color = "gray";
        button.innerText = text;
        return button;
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

    function addMangaCheckbox(){
        let imgs = $(PIC_SRC);
        imgs.each((index,element)=>{
            element.before(createCheckbox());
        });
    }

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
            getImagePage(pos.parentElement.previousSibling.href).then(async ([data, author, pid])=>{
                let dlFolderId = await getFolderId(author, pid);
                if(dlFolderId === undefined){
                    console.log("创建文件夹失败！尝试直接下载……")
                }
                else{
                    data.folderId = dlFolderId;
                }
                download(data);
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
                        resolve([item, author, authorId]);
                    }
                    catch(e){
                        reject(e);
                    }
                }
            });
        });
    }

    function bookmarkAppendButton(){
        let button = document.createElement("div");
        button.className = "sc-1ij5ui8-0 cBRwmk sc-13ywrd6-7 jDGNKo";
        button.setAttribute("aria-disabled", "false");
        button.setAttribute("role", "button");
        button.innerHTML='<div aria-disabled="false" class="sc-4a5gah-0 fRfnFc"><div class="sc-4a5gah-1 bxlGvy">下载</div></div>';
        button.addEventListener("click", ()=>{
            $(BOOKMARKS_SELECT).each((index, element)=>{
                if($(SELECT_CHECK, element)[0].checked){
                    downloadNewPage("https://www.pixiv.net" + $(SELECT_URL, element).attr("to"));
                }
            })
        });
        $(BDL_BUTTON_POS).append(button);
        $("div[type=illust] .rp5asc-0:first").click();
        $("div[type=illust] .rp5asc-0:first").click();
        $(OVER_BUTTON).click(()=>{
            waitForKeyElements(BOOKMARKS_BUTTON, bookmarksPage, true);
        });
    }

    async function downloadNewPage(url){
        let [data, author, id] = await getImagePage(url);
        let dlFolderId = await getFolderId(author, id);
        if(dlFolderId === undefined){
            console.log("创建文件夹失败！尝试直接下载……")
        }
        else{
            data.folderId = dlFolderId;
        }
        download(data);
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
})();

// function waitForKeyElements (
//     selectorTxt,    /* Required: The jQuery selector string that
//                         specifies the desired element(s).
//                     */
//     actionFunction, /* Required: The code to run when elements are
//                         found. It is passed a jNode to the matched
//                         element.
//                     */
//     bWaitOnce,      /* Optional: If false, will continue to scan for
//                         new elements even after the first match is
//                         found.
//                     */
//     iframeSelector  /* Optional: If set, identifies the iframe to
//                         search.
//                     */
// )