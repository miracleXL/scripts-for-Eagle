// ==UserScript==
// @name         Save Pixiv Pictures to Eagle
// @name:zh-CN   下载Pixiv图片到Eagle
// @namespace    https://github.com/miracleXL
// @icon		 https://www.pixiv.net/favicon.ico
// @version      0.2.3
// @description  Collect pictures in pixiv to eagle.
// @author       miracleXL
// @match        https://www.pixiv.net/artworks/*
// @connect      localhost
// @connect      www.pixiv.net
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function(){
    'use strict';

    if (location.href.indexOf("pixiv.net") === -1) {
        console.log("This script only works on pixiv.net.");
        return;
    }

    // Eagle API 服务器位置
    const EAGLE_SERVER_URL = "http://localhost:41595";
    const EAGLE_IMPORT_API_URL = `${EAGLE_SERVER_URL}/api/item/addFromURL`;
    const EAGLE_IMPORT_API_URLS = `${EAGLE_SERVER_URL}/api/item/addFromURLs`;
    const EAGLE_CREATE_FOLDER_API_URL = `${EAGLE_SERVER_URL}/api/folder/create`;
    const EAGLE_GET_FOLDERS_API_URL = `${EAGLE_SERVER_URL}/api/folder/list`;

    //Pixiv页面中的标签和标签翻译
    const TAG_CLASS = "gtm-new-work-tag-event-click";
    const TAG_TRANS_CLASS = "gtm-new-work-translate-tag-event-click";

    const HEADERS = {
                "referer": "https://www.pixiv.net/",
                "sec-fetch-dest": "image",
                "sec-fetch-mode": "no-cors",
                "sec-fetch-site": "cross-site",
            };

    // 每秒尝试加载一次
    let loadMain = setInterval(main, 1000);

    function main(){
        window.clearInterval(loadMain);
        let divs_section = document.getElementsByClassName("sc-181ts2x-0 jPZrYy")[0];
        if(divs_section === undefined) return;
        //暂时无法保存动图，如果是动图则什么都不做
        if(document.getElementsByClassName("tu09d3-1 MNNrM").length !== 0){
            console.log("无法保存动图！");
            return;
        }
        let image = document.getElementsByClassName("sc-1qpw8k9-3 ckeRFU")[0];
        let mode = image ? "image" : "manga" ;

        addButtons(mode,divs_section);
        document.getElementsByClassName("sc-1yvhotl-2 hGipVQ")[0].onchange = main;
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

    async function downloadAll(data){
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

    function getImageData(){
        let images = document.getElementsByClassName("sc-1qpw8k9-3 ckeRFU")[0];// 单图
        images = images ? images : document.getElementsByClassName("sc-1qpw8k9-3 lmFZOm")[0];//多图
        //获取标题
        let name = document.getElementsByClassName("sc-1u8nu73-3 feoVvS")[0];
        if(name === undefined){
            name = "";
        }else{
            name = name.textContent;
        }
        //获取描述
        let annotation = document.getElementById("expandable-paragraph-0");
        if(annotation){annotation = annotation.textContent;}
        else{annotation = "";}
        //把pixiv标签和标签翻译添加进eagle标签
        let tags = [];
        let firstTag = document.getElementsByClassName("nqp4a5-0")[0];
        if(firstTag !== undefined){
            tags.push(firstTag.textContent);
        }
        document.getElementsByClassName(TAG_CLASS).forEach(item => {tags.push(item.text);});
        document.getElementsByClassName(TAG_TRANS_CLASS).forEach(item => {tags.push(item.text);});
        let data = {
            "url": images.href,
            "name": name,
            "website": document.URL,
            "tags": tags,
            "headers": HEADERS
        }
        let author = document.getElementsByClassName("sc-10gpz4q-5 bUnVlH")[0].textContent.split("@")[0];
        return [data,author];
    };


    function getImagesData(){
        let images = document.getElementsByClassName("sc-1qpw8k9-3 ckeRFU");//单图
        images = images[0] ? images : document.getElementsByClassName("sc-1qpw8k9-3 lmFZOm");//多图
        let data = {"items":[]}
        //获取标题
        let name = document.getElementsByClassName("sc-1u8nu73-3 feoVvS")[0];
        if(name === undefined){
            name = "";
        }else{
            name = name.textContent;
        }
        //获取描述
        let annotation = document.getElementById("expandable-paragraph-0");
        if(annotation){annotation = annotation.textContent;}
        else{annotation = "";}
        //把pixiv标签和标签翻译添加进eagle标签
        let tags = [];
        let firstTag = document.getElementsByClassName("nqp4a5-0")[0];
        if(firstTag !== undefined){
            tags.push(firstTag.textContent);
        }
        document.getElementsByClassName(TAG_CLASS).forEach(item => {tags.push(item.text);});
        document.getElementsByClassName(TAG_TRANS_CLASS).forEach(item => {tags.push(item.text);});
        let count = 0;
        images.forEach(url => {
            if(url === undefined) return;
            data.items.push({
                "url": url.href,
                "name": name + `_${count}`,
                "website": document.URL,
                "annotation": annotation,
                "tags": tags,
                "headers": HEADERS
            });
            count++;
        });
        console.log(`准备开始下载，共计${count}张图`)
        // 获取作者名
        let author = document.getElementsByClassName("sc-10gpz4q-5 bUnVlH")[0].textContent;
        // 删除多余后缀，为避免误伤，同时使用多种符号不作处理
        let patt = / *[@＠◆■◇☆].+/;
        let test = author.match(patt);
        if(test.length == 1){
            author.replace(test[0],"");
        }
        return [data,author];
    };

    function changeStyle(button){
        button.className = "_1vHxmVH _35vRH4a";
    }

    //在收藏按钮旁边添加下载按钮
    function addButtons(mode,buttonPos){
        let button = document.createElement('div');
        button.setAttribute('class', 'sc-181ts2x-01');
        button.setAttribute('style', 'margin-right: 23px;');
        button.innerHTML = '<button type="button" id="download" class="_35vRH4a"><span class="_3uX7m3X">下载全部</span></button>';
        if(buttonPos !== undefined){
            buttonPos.appendChild(button);
        }
        //绑定点击按钮时下载事件
        button.addEventListener("click", async function(){
            //下载同时自动点赞+收藏
            try{
                document.getElementsByClassName("_35vRH4a")[0].click();
                document.getElementsByClassName("kgq5hw-0 iPGEIN gtm-main-bookmark")[0].click();
            }catch(e){}
            let [data, author] = getImagesData();
            let dlFolderId = await getFolderId(author);
            if(dlFolderId === undefined){
                console.log("创建文件夹失败！尝试直接下载……")
            }
            else{
                data.folderId = dlFolderId;
            }
            downloadAll(data);
            changeStyle(button);
        });
        // 若为多图添加复选框和下载选择按键……计划中是这样的
        if(mode === "manga"){
            let button2 = document.createElement('div');
            button2.setAttribute('class', 'sc-181ts2x-01');
            button2.setAttribute('style', 'margin-right: 23px;');
            button2.innerHTML = '<button type="button" id="download_1" class="_35vRH4a"><span class="_3uX7m3X">下载首张</span></button>';
            if(buttonPos) buttonPos.appendChild(button2);
            button2.addEventListener("click", async function(){
                let [data, author] = getImageData();
                let dlFolderId = await getFolderId(author);
                if(dlFolderId === undefined){
                    console.log("创建文件夹失败！尝试直接下载……")
                }
                else{
                    data.folderId = dlFolderId;
                }
                download(data);
                changeStyle(button2);
            })
        }
    };

})();