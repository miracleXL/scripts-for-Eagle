// ==UserScript==
// @name                Save Danbooru Images to Eagle
// @name:zh             批量导入 Danbooru 图片到 Eagle
// @name:zh-CN          批量导入 Danbooru 图片到 Eagle
// @name:zh-TW          批次導入 Danbooru 圖片到 Eagle
// @name:ja-JP          Danbooruの画像を Eagle に保存

// @description         Save images from Danbooru to Eagle.
// @description:zh      在danbooru网页上添加下载按钮直接导入Eagle

// @author              MiracleXL
// @namespace           None
// @homepageURL         None
// @icon                None

// @match               danbooru.donmai.us/posts/*
// @match               safebooru.donmai.us/posts/*
// @connect             danbooru.donmai.us
// @connect             safebooru.donmai.us
// @connect             localhost
// @grant               GM_xmlhttpRequest

// @date                2020/12/22
// @modified            2020/11/23
// @version             0.0.1

// ==/UserScript==

(function() {
    'use strict';

    // Eagle API 服务器位置
    const EAGLE_SERVER_URL = "http://localhost:41595";
    const EAGLE_IMPORT_API_URL = `${EAGLE_SERVER_URL}/api/item/addFromURL`;
    const EAGLE_IMPORT_API_URLS = `${EAGLE_SERVER_URL}/api/item/addFromURLs`;
    const EAGLE_CREATE_FOLDER_API_URL = `${EAGLE_SERVER_URL}/api/folder/create`;
    const EAGLE_GET_FOLDERS_API_URL = `${EAGLE_SERVER_URL}/api/folder/list`;

    function addButton(){
        let button = document.createElement("button");
        button.className = "ui-button ui-widget ui-corner-all";
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