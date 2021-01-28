// ==UserScript==
// @name                    Save Pixiv Pictures to Eagle
// @name:zh                 下载Pixiv图片到Eagle
// @name:zh-CN              下载Pixiv图片到Eagle
// @description             Collect pictures in pixiv to eagle.
// @description:zh          在Pixiv上添加可以导入图片到Eagle的下载按钮，默认保存所有标签，以创作者名创建文件夹保存，能力有限暂无法处理动图。新增首页添加下载按钮，下次再优化图标。
// @description:zh-CN       在Pixiv上添加可以导入图片到Eagle的下载按钮，默认保存所有标签，以创作者名创建文件夹保存，能力有限暂无法处理动图。新增首页批量下载按钮，下次再优化图标。

// @namespace               https://github.com/miracleXL
// @icon		            https://www.pixiv.net/favicon.ico
// @version                 0.3.0
// @author                  miracleXL
// @match                   https://www.pixiv.net/*
// @connect                 localhost
// @connect                 www.pixiv.net
// @grant                   GM_xmlhttpRequest
// @grant                   GM_registerMenuCommand
// @require                 https://code.jquery.com/jquery-3.5.1.min.js
// @require                 https://greasyfork.org/scripts/2199-waitforkeyelements/code/waitForKeyElements.js?version=6349
// ==/UserScript==

(function(){
    'use strict';

    if (location.href.indexOf("pixiv.net") === -1) {
        console.log("This script only works on pixiv.net.");
        return;
    }

    // 设置项
    const saveTags = true; // 是否保存标签
    const tagAuthor = false; // 是否将作者名加入标签
    const addToFavor = true; // 下载时是否同时加入收藏
    const enableMainpage = true; // 首页添加按钮，目前实现方式过于丑陋，等学会svg绘图再修改图标
    // 设置项结束

    //Pixiv页面中的标签和标签翻译
    const TAG_CLASS = "gtm-new-work-tag-event-click";
    const TAG_TRANS_CLASS = "gtm-new-work-translate-tag-event-click";
    // Pixiv首页图片选择器
    const MAIN_PAGE_SELECTOR = ".iasfms-2.gGOhDf";
    // 下载按键位置
    const BUTTON_POS = ".sc-181ts2x-0.jPZrYy";
    // 单图
    const PIC_SRC = ".sc-1qpw8k9-3.ckeRFU";
    // 多图
    const PICS_SRC = ".sc-1qpw8k9-3.lmFZOm";
    const CLICK_POS = ".sc-1mz6e1e-1.kyYawS";
    // 动图
    const UGO_SRC = ".tu09d3-1.MNNrM";

    // 处理作者名多余后缀的正则
    let patt = / *[@＠◆■◇☆：:\\\/].*/;

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
    const EAGLE_GET_FOLDERS_API_URL = `${EAGLE_SERVER_URL}/api/folder/list`;

    // 插画页面
    function main(){
        waitForKeyElements(BUTTON_POS, setMode, false);
        if(enableMainpage && document.URL === "https://www.pixiv.net/"){
            waitForKeyElements(MAIN_PAGE_SELECTOR, mainPage, false);
            return;
        }
    }

    // 首页
    function mainPage(element){
        element.append(addDownloadButton());
    }

    function setMode(){
        if($(UGO_SRC).length !== 0){
            return ugoiraPage();
        }
        if($(PIC_SRC).length !== 0){
            return imagePage();
        }
        if($(PICS_SRC).length !== 0){
            return mangaPage();
        }
        return ugoiraPage();
    };

    // 单图
    function imagePage(){
        let pos = $(BUTTON_POS);
        if(pos.length === 0) return;
        let button = createButton("下载");
        pos[0].appendChild(button);
        button.addEventListener("click", async function(){
            //下载同时自动点赞+收藏
            if(addToFavor){
                try{
                    document.getElementsByClassName("_35vRH4a")[0].click();
                    document.getElementsByClassName("kgq5hw-0 iPGEIN gtm-main-bookmark")[0].click();
                }catch(e){}
            }
            let [data, author] = getImageData();
            let dlFolderId = await getFolderId(author);
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
        let button = createButton("下载");
        pos[0].appendChild(button);
        //绑定点击按钮时下载事件
        button.addEventListener("click", async () => {
            //下载同时自动点赞+收藏
            if(addToFavor){
                try{
                    document.getElementsByClassName("_35vRH4a")[0].click();
                    document.getElementsByClassName("kgq5hw-0 iPGEIN gtm-main-bookmark")[0].click();
                }catch(e){}
            }
            let [data, author] = getImagesData();
            let dlFolderId = await getFolderId(author);
            if(dlFolderId === undefined){
                console.log("创建文件夹失败！尝试直接下载……");
            }
            else{
                data.folderId = dlFolderId;
            }
            downloadAll(data);
            changeStyle(button);
        });
        let clickpos = $(CLICK_POS);
        if(clickpos.length !== 0){
            clickpos[0].addEventListener("click",()=>{
                $("span",button)[0].innerText = "下载全部";
                let button2 = createButton("下载选择");
                pos[0].appendChild(button2);
                button2.addEventListener("click", async () => {
                    let [data, author] = getSelectData();
                    let dlFolderId = await getFolderId(author);
                    if (dlFolderId === undefined) {
                        console.log("创建文件夹失败！尝试直接下载……");
                    }
                    else {
                        data.folderId = dlFolderId;
                    }
                    downloadAll(data);
                    changeStyle(button2);
                });
                waitForKeyElements(".sc-1mz6e1e-1.QBVJO.gtm-illust-work-scroll-finish-reading", addMangaCheckbox, true);
            })
        }
    }

    // 动图
    function ugoiraPage(){
        console.log("暂无法处理动图！")
    }

    function download(data){
        GM_xmlhttpRequest({
            url: EAGLE_IMPORT_API_URL,
            method: "POST",
            data: JSON.stringify(data),
            onload: function(response) {
                if(response.statusText !== "OK"){
                    console.log("请检查eagle是否打开！");
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
                    alert("请检查eagle是否打开！");
                    console.log("下载失败！")
                }
            }
        });
    }

    // 获取文件夹id
    async function getFolderId(author){
        if(!author) return;
        let folders = await getFolders();
        let dlFolder;
        if(folders){
            for(let folder of folders){
                if(folder.name === "画师"){
                    for(let f of folder.children){
                        if(f.name === author) dlFolder = f;
                    }
                }
                if(folder.name === author){
                    dlFolder = folder;
                }
            }
            if(dlFolder === undefined) dlFolder = await creatFolder(author);
        }
        else{
            console.log("获取文件夹信息失败！");
            alert("下载失败！");
            return;
        }
        return dlFolder.id;
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
    function creatFolder(folderName){
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: EAGLE_CREATE_FOLDER_API_URL,
                method: "POST",
                data: JSON.stringify({ folderName: folderName }),
                onload: function(response) {
                    var result = JSON.parse(response.response);
                    if (result.status === "success" && result.data && result.data.id) {
                        return resolve(result.data);
                    }
                    else{
                        return reject();
                    }
                }
            })
        })
    }

    function getCommonInfo(){
        //获取标题
        let name = document.getElementsByClassName("sc-1u8nu73-3 feoVvS")[0];
        if(name === undefined){
            name = "";
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
            let firstTag = document.getElementsByClassName("nqp4a5-0")[0];
            if(firstTag !== undefined){
                tags.push(firstTag.textContent);
            }
            document.getElementsByClassName(TAG_CLASS).forEach(item => {tags.push(item.text);});
            document.getElementsByClassName(TAG_TRANS_CLASS).forEach(item => {tags.push(item.text);});
        }
        let author = document.getElementsByClassName("sc-10gpz4q-5 bUnVlH")[0].textContent;
        // 删除多余后缀，为避免误伤，同时使用多种符号不作处理
        let test = author.match(patt);
        if(test && test.length === 1){
            author = author.replace(test[0],"");
        }
        if(tagAuthor){
            tags.push(author);
        }
        return [name, annotation, tags, author];
    }

    function getImageData(){
        let image = document.getElementsByClassName("sc-1qpw8k9-3 ckeRFU")[0];// 单图
        if(!image){
            console.log("下载失败！");
            return;
        }
        let [name, annotation, tags, author] = getCommonInfo();
        let data = {
            "url": image.href,
            "name": name,
            "website": document.URL,
            "tags": tags,
            "annotation": annotation,
            "headers": HEADERS
        }
        return [data,author];
    };

    function getSelectData(){
        let checkbox = $(".to_eagle");
        let [name, annotation, tags, author] = getCommonInfo();
        let data = {"items":[]};
        checkbox.each((index, element)=>{
            if(element.firstElementChild.checked === true){
                data.items.push({
                    "url": element.nextElementSibling.href,
                    "name": name + `_${index}`,
                    "website": document.URL,
                    "annotation": annotation,
                    "tags": tags,
                    "headers": HEADERS
                })
            }
        });
        return [data, author];
    };

    function getImagesData(){
        let images = $(PIC_SRC);
        images = images.length === 0 ? $(PICS_SRC) : images;
        if(images.length === 0){
            console.log("下载失败！");
            return [null, null];
        }
        let data = {"items":[]};
        let [name, annotation, tags, author] = getCommonInfo();
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
        return [data,author];
    };

    function changeStyle(button){
        button.className = "_1vHxmVH _35vRH4a";
    }

    function createButton(text){
        let button = document.createElement('div');
        button.setAttribute('class', 'sc-181ts2x-01');
        button.setAttribute('style', 'margin-right: 23px;');
        button.innerHTML = `<button type="button" id="download" class="_35vRH4a"><span class="_3uX7m3X">${text}</span></button>`;
        return button;
    }

    // 创建选择框
    function createCheckbox(){
        let input_container = document.createElement("div");
        input_container.setAttribute("class","to_eagle");
        let checkbox = document.createElement("input");
        checkbox.setAttribute("type","checkbox");
        input_container.appendChild(checkbox);
        input_container.style.position = "absolute";
        input_container.style.zIndex = 3;
        input_container.style.left = "1px";
        input_container.style.backgroundColor = "rgba(0,0,0,.1)";
        input_container.style.padding = "9px";
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
        let button = document.createElement("button");
        pos.appendChild(button);
        button.setAttribute("class","dl_to_eagle");
        button.setAttribute("type", "button");
        let icon = document.createElement("svg");
        icon.setAttribute("viewBox", "0 0 32 32");
        icon.setAttribute("width", 32);
        icon.setAttribute("height", 32);
        icon.innerHTML = '<line x1="16" y1="0" x2="16" y2="32"></line>\n<line x1="0" y1="16" x2="32" y2="16"></line>';
        button.appendChild(icon);
        button.addEventListener("click", ()=>{
            getImagePage(pos.parentElement.previousSibling.href).then(async ([data, author])=>{
                let dlFolderId = await getFolderId(author);
                if(dlFolderId === undefined){
                    console.log("创建文件夹失败！尝试直接下载……")
                }
                else{
                    data.folderId = dlFolderId;
                }
                download(data);
            });
        });
        button.innerText = "下载";
        return pos;
    }

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
                            for(let trans of Object.values(tag.translation)){
                                item.tags.push(trans);
                            }
                            console.log(tag);
                        }
                        let author = illustData.userName || illustData.userAccount;
                        resolve([item,author]);
                    }
                    catch(e){
                        reject(e);
                    }
                }
            });
        });
    }

    main();
})();