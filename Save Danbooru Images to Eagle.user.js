// ==UserScript==
// @name                Save Danbooru Images to Eagle
// @name:zh             导入 Danbooru 图片到 Eagle

// @description         Save images from Danbooru to Eagle.
// @description:zh      在danbooru网页上添加下载按钮直接导入Eagle

// @author              miracleXL
// @namespace           https://github.com/miracleXL
// @homepageURL         https://github.com/miracleXL/scripts-for-Eagle
// @icon                https://danbooru.donmai.us/favicon.ico

// @match               danbooru.donmai.us/posts/*
// @match               safebooru.donmai.us/posts/*
// @match               danbooru.donmai.us/pools/*
// @match               safebooru.domai.us/pools/*
// @connect             danbooru.donmai.us
// @connect             safebooru.donmai.us
// @connect             localhost
// @grant               GM_xmlhttpRequest

// @date                2020/12/22
// @modified            2020/11/23
// @version             0.1.0

// ==/UserScript==

(function() {
    'use strict';

    // Eagle API 服务器位置
    const EAGLE_SERVER_URL = "http://localhost:41595";
    const EAGLE_IMPORT_API_URL = `${EAGLE_SERVER_URL}/api/item/addFromURL`;
    const EAGLE_IMPORT_API_URLS = `${EAGLE_SERVER_URL}/api/item/addFromURLs`;
    const EAGLE_CREATE_FOLDER_API_URL = `${EAGLE_SERVER_URL}/api/folder/create`;
    const EAGLE_GET_FOLDERS_API_URL = `${EAGLE_SERVER_URL}/api/folder/list`;

    let mode = document.URL.split("/")[3];

    function addButton(){
        let button = document.createElement("button");
        button.className = "ui-button ui-widget ui-corner-all";
        if(mode === "posts"){
            button.innerText = "下载";
            let buttons_div = document.getElementsByClassName("fav-buttons")[0];
            buttons_div.firstElementChild.style.display = "inline";
            buttons_div.appendChild(button);
            //绑定下载事件
            button.addEventListener("click",async ()=>{
                let [data,pool] = getImageData();
                if(pool){
                    let folderId = await getFolderId(pool);
                    if(folderId){
                        data.folderId = folderId;
                    }
                }
                console.log(data);
                download(data);
            })
        }
        else{
            button.innerText = "下载全部";
            let buttonPos = document.getElementById("description");
            buttonPos.appendChild(button);
            //绑定下载事件
            button.addEventListener("click",async ()=>{
                let [data,pool] = getPoolData();
                if(pool){
                    let folderId = await getFolderId(pool);
                    if(folderId){
                        data.folderId = folderId;
                    }
                }
                console.log(data);
                downloadAll(data);
            })
        }
    }

    addButton();

    function download(data){
        GM_xmlhttpRequest({
            url: EAGLE_IMPORT_API_URL,
            method: "POST",
            data: JSON.stringify(data),
            onload: function(response) {
                if(response.statusText !== "OK"){
                    console.log(response);
                    alert("下载失败！")
                }
            }
        });
    }

    function downloadAll(data){
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

    function getImageData(){
        let name = document.getElementById("original-artist-commentary");
        if(name){
            name = name.firstElementChild.textContent;
        }
        else{
            let pool = document.getElementsByClassName("pool-name")[0]
            if(pool){
                pool = pool.firstElementChild;
                var poolname = pool.textContent.replace("Pool: ","");
                name = pool + " " + pool.title;
            }
            else{
                name = document.title;
            }
        }
        let data = {
            "url": document.getElementById("post-option-view-original").firstElementChild.href,
            "name": name,
            "website": document.getElementById("post-info-source").firstElementChild.href,
            "tags": [],
            "headers": {
                "referer" : document.URL
            }
        };
        for(let tag of document.getElementsByClassName("search-tag")){
            data.tags.push(tag.textContent);
        };
        return [data,poolname];
    };

    function getPoolData(){
        try{
            var name = document.getElementsByClassName("pool-category-series")[0].textContent;
        }catch(e){
            name = document.title;
            console.log(e);
        }
        let data = {
            "items":[]
        };
        let count = 0;
        for(let article of document.getElementsByTagName("article")){
            let item = {
                "url": article.getAttribute("data-file-url"),
                "name": name + "_" + count,
                "website": article.getAttribute("data-normalized-source"),
                "tags": article.getAttribute("data-tags").split(" "),
                "headers": {
                    "referer" : document.URL
                }
            };
            data.items.push(item);
        }
        return [data,name];
    }

    // 获取文件夹id
    async function getFolderId(pool){
        let folders = await getFolders();
        let dlFolder;
        if(folders){
            for(let folder of folders){
                if(folder.name === pool){
                    dlFolder = folder;
                }
            }
            if(dlFolder === undefined) dlFolder = await creatFolder(pool);
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

})();