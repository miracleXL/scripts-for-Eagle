// ==UserScript==
// @name         Save Pixiv pictures to Eagle
// @name:zh-CN   下载Pixiv图片到Eagle
// @namespace    http://tampermonkey.net/
// @version      0.2.0
// @description  Collect pictures in pixiv to eagle.
// @author       miracleXL
// @match        https://www.pixiv.net/artworks/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(
    function(){
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

        //Pixiv页面中的标签和标签翻译
        const TAG_CLASS = "gtm-new-work-tag-event-click";
        const TAG_TRANS_CLASS = "gtm-new-work-translate-tag-event-click";

        const HEADERS = {
                    "referer": "https://www.pixiv.net/",
                    "sec-fetch-dest": "image",
                    "sec-fetch-mode": "no-cors",
                    "sec-fetch-site": "cross-site",
                };

        function download(data){
            GM_xmlhttpRequest({
                url: EAGLE_IMPORT_API_URL,
                method: "POST",
                data: JSON.stringify(data),
                onload: function(response) {
                    if(response.statusText != "OK"){
                        console.log("请检查eagle是否打开！");
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
                    if(response.statusText != "OK"){
                        alert("请检查eagle是否打开！");
                        console.log("下载失败！")
                    }
                }
            });
        }

        function getImagesData(){
            let images = document.getElementsByClassName("sc-1qpw8k9-3 ckeRFU");
            images = images[0] ? images : document.getElementsByClassName("sc-1qpw8k9-3 lmFZOm");
            let data = {"items":[]}
            let name = document.getElementsByClassName("sc-1u8nu73-3 feoVvS")[0].textContent;
            //把pixiv标签和标签翻译添加进eagle标签
            let tags = [document.getElementsByClassName("sc-10gpz4q-5 bUnVlH")[0].text];
            document.getElementsByClassName(TAG_CLASS).forEach(item => {tags.push(item.text);});
            document.getElementsByClassName(TAG_TRANS_CLASS).forEach(item => {tags.push(item.text);});
            let count = 0;
            images.forEach(url => {
                if(url === undefined) return;
                data.items.push({
                    "url": url.href,
                    "name": name + `_${count}`,
                    "website": document.URL,
                    "tags": tags,
                    "headers": HEADERS
                });
                count++;
            });
            console.log(`开始下载，共计${count}张图`)
            return data;
        };

        //在收藏按钮旁边添加下载按钮
        function addButtons(){
            let button = document.createElement('div');
            button.setAttribute('class', 'sc-181ts2x-01');
            button.setAttribute('style', 'margin-right: 23px;');
            button.innerHTML = '<button type="button" id="download" class="_35vRH4a"><span class="_3uX7m3X">下载</span></button>';
            let divs_section = document.getElementsByClassName("sc-181ts2x-0 jPZrYy")[0];
            if(divs_section != undefined){
                divs_section.appendChild(button);
            }
            //绑定点击按钮时下载事件
            button.addEventListener("click", function(){
                let data = getImagesData();
                console.log(data);
                downloadAll(data);
            });
        };

        setTimeout(function(){
            //暂时无法保存动图，如果是动图则什么都不做
            if(document.getElementsByClassName("tu09d3-1 MNNrM").length != 0){
                console.log("无法保存动图！");
                return;
            }
            let image = document.getElementsByClassName("sc-1qpw8k9-3 ckeRFU")[0];
            let mode = image ? "image" : "manga" ;

            addButtons();
        }, 1000);
    }
)();