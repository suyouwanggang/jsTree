import { createEl } from "./helper";

type TreeNodeData = {
    [key: string]: unknown;
    id?: string | number;
    parentId?: string | number;
    close?: boolean; //只有close=false 的节点渲染时才展开
    name?: string;
    children?: TreeNodeData[];
    loadsize?: number;
    _children?: TreeNodeData[];//内部使用，过滤的匹配的孩子放在此属性
    _parent?: TreeNodeData;//上级节点
    _loadedChild?: boolean;//是否加载了下级
    _loadMoreDom?: HTMLElement;
    _childDivDom?:HTMLElement|DocumentFragment;
};


interface TreeFilter {
    (data: TreeNodeData, ...arg: unknown[]): boolean;
}
const defaultFilter: TreeFilter = (data: TreeNodeData, name: string) => {
    if (name == null || name === undefined || name === '' || name.trim() === '') {
        return true;
    }
    if (data && data.name !== undefined) {
        name = name.toLowerCase().trim();
        return data.name.toLowerCase().indexOf(name) !== -1;
    }
    return false;
};
const filterTreeDataArray = (root: TreeNodeData, filter: TreeFilter, ...filterObject: unknown[]): {
    node: TreeNodeData
    size: number,
} => {
    const map = new Map<TreeNodeData, Array<TreeNodeData>>();
    const setAddNode = new Set<TreeNodeData>();
    //key 为node, value:为下级满足的节点
    const parentMap = new Map<TreeNodeData, TreeNodeData>();
    parentMap.set(root, undefined);
    //key 为node, value:为父节点
    const iteratorFun = (node: TreeNodeData, parent: TreeNodeData) => {
        parentMap.set(node, parent);
        node.loadsize=undefined;
        node._loadMoreDom=undefined;
        node._parent = parent; //设置上级
        // console.log(node.name);
        if ( (filter === null || filter.apply(null, [node, ...filterObject]))) {
            // console.log('match=='+node.name);
            let tempNode = node;
            while (tempNode && !setAddNode.has(tempNode)) {
                setAddNode.add(tempNode);
                //console.log('tempname=='+ tempNode.name);
                let matchSub = map.get(tempNode._parent);
                if (matchSub === undefined) {
                    matchSub = [];
                    map.set(tempNode._parent, matchSub);
                }
                matchSub.push(tempNode);
                tempNode = tempNode._parent;
            }
        }
        if (node.children) {
            node.children.forEach((item) => iteratorFun(item, node));
        }
    };
    root._children = null;
    iteratorFun(root, null);
    const iteratorMap = (node: TreeNodeData) => {
        const sub = map.get(node);
        if (sub !== undefined) {
            node._children = sub;
            sub.forEach((item) => iteratorMap(item));
        } else {
            node._children = [];
        }
    };
    iteratorMap(root);
    return {
        size: setAddNode.size,
        node: setAddNode.size == 0 ? null : root
    };
};
const filterTreeData = (root: TreeNodeData, filter: TreeFilter, ...args: unknown[]): {
    node: TreeNodeData
    size: number,
} => {
    const argArray = [root, filter, ...args];
    return filterTreeDataArray.apply(null, argArray);
}
const findDataByKey = function (data: TreeNodeData, key: string | number): TreeNodeData {
    if (data.id === key) {
        return data;
    } else {
        const child = data.children;
        if (child) {
            let found = null;
            for (let i = 0, j = child.length; i < j; i++) {
                found = findDataByKey(child[i], key);
                if (found) {
                    return found;
                }
            }
        }
    }
    return null;
};
type TreeConfig = {
    /**
     * 是否包含根节点
     */
    includeRoot?:boolean;
    /**
     * 绑定过滤的input 
     */
    filterInput?: string | HTMLInputElement;
    /**
     * 渲染到哪里
     */
    renderDom: string | HTMLElement;
    nodeIcon:string;
    /**
     * 选中的节点
     */
    selectedNodeID?: string | number;
    /**
     * 选中的节点样式
     */
    selectedNodeClass?: string;
    /**
     * 选中节点的样式
     */
    selectedNodeStyle: any;
    /**
     * 自定义渲染treeNode
     * @param domNode 
     * @param data 
     */
    renderNodeTemplate?(domNode: HTMLElement, data: TreeNodeData): void;
    /**
     * 节点选中回调
     */
    onNodeSelect?: (event: Event, nodeData: TreeNodeData, dom: HTMLElement, oldSelectDom: HTMLElement) => void;
    /**
     * 没有节点提示Dom
     */
    noMatchDom: string | HTMLElement;

};
export default class Tree {
    /** 
     * 是否包含root 节点
     * **/
    includeRoot = true;
    root: TreeNodeData;
    renderDom: HTMLElement;
    filterInput: HTMLInputElement;
    nodeIcon: string = 'teamPersons';
    /**
     * 控制每个节点的孩子初次只加载100个
     */
    loadchildSize = 100;
    private _searchString: string;
    /**
     * 节点过滤方法
     */
    filterFun = defaultFilter;
    /**
     * 过滤后的节点
     */
    private filterNode: TreeNodeData | null = undefined;
    config: TreeConfig;
    /**
     * 构造函数 
     * @param root  根节点数据 
     * @param list  如果不为空，则会根据ID,parent, 将数据放入到root 节点 children
     */
    constructor(root: TreeNodeData, config: TreeConfig) {
        this.config = config;
        if (config.renderDom instanceof HTMLElement) {
            this.renderDom = config.renderDom;
        } else {
            this.renderDom = document.getElementById(config.renderDom);
        }
        if (config.filterInput != null) {
            this.bindFilterInput();
        }
        if(config.includeRoot!=undefined   ){
            this.includeRoot=config.includeRoot;
        }
        if(config.nodeIcon!=undefined  ){
            this.nodeIcon=config.nodeIcon;
        }
        this.root = root;
        this.searchString = '';
        //this.render();
    }
    private setSelectedNodeOpen(){
        if(this.config.selectedNodeID){
            var node=findDataByKey(this.root,this.config.selectedNodeID);
            if(node){
                node.close=false;
            }
            while(node._parent ){
                node._parent.close=false;
                node=node._parent;
            }
        }
        window.setTimeout(( )=>{
            const node=document.getElementById('node'+this.config.selectedNodeID);
            if(node!=null){
               node.scrollIntoView(false);
            }
        },1000)
    }
    private __observer:IntersectionObserver=null;
    private _internalID:number=undefined;
    private bindInspectInToView(){
        const tree=this;
        if(window.IntersectionObserver!=undefined){
            this.__observer = new IntersectionObserver((entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
                entries.forEach((ioe) => {
                    const el = ioe.target;
                    const intersectionRatio = ioe.intersectionRatio;
                    if (intersectionRatio > 0 && intersectionRatio <= 1) {
                      $(el).click(); 
                    }
                });
            },{
                root:this.renderDom
            });
        }else if(tree._internalID==undefined){
            tree._internalID= window.setInterval(function(){
                let children= $(tree.renderDom).find("div.loadMore");
                for(let i=0,j=children.length;i<j;i++){
                    const item=children[i];
                    if(item.clientHeight>0){
                        var rectDom=tree.renderDom.getBoundingClientRect();
                        var rect=item.getBoundingClientRect();
                        if(rect.top>rectDom.top&& rect.bottom<=rectDom.bottom){
                            $(item).click();
                            children=null;
                            break;
                        }
                    }
                }
            },100)
        }
    }
    private bindFilterInput() {
        const tree = this;
        if (this.config.filterInput instanceof HTMLElement) {
            this.filterInput = this.config.filterInput;
        } else {
            this.filterInput = document.getElementById(this.config.filterInput) as HTMLInputElement;
        }
        let timeoutID: number;
        if (this.filterInput) {
            $(this.filterInput).on('keyup', function () {
                timeoutID && window.clearTimeout(timeoutID);
                timeoutID = window.setTimeout(() => {
                    tree.searchString = tree.filterInput.value;
                }, 300)
            })
        }
    }
    filterNodeSize = 0;
    /**
     * 设置查询字符串
     */
    set searchString(str: string) {
        if (this._searchString != str) {
            this._searchString = str;
            const result = filterTreeData(this.root, this.filterFun, this._searchString);
            this.filterNode = result.node;
            this.filterNodeSize = result.size;
            this._loadLevel = 0;
            this.setSelectedNodeOpen();
            this.render();
        }
    }
    get searchString() {
        return this._searchString;
    }
    createNodeDom(node: TreeNodeData) {
        var nodeDiv = createEl('div', {
            style: {
                whiteSpace: 'nowrap'
            }
        });
        (nodeDiv as any).nodeData = node;
        return nodeDiv;
    }
    private _noMatchDom: string;
    /**
     * 渲染树
     * @param dom 
     */
    render(): void {
        if(this.__observer!=null&&this.__observer!=undefined){
            this.__observer.disconnect();
            this.__observer=null;
        }
        this._loadLevel=0;
        this.renderDom.innerHTML = '';
        this.bindInspectInToView();
        if (this.filterNode === undefined) {
            this.filterNode = filterTreeData(this.root, this.filterFun, this._searchString);
        }
        if (this.filterNodeSize > 0) {
            if (this.includeRoot) {
                var nodeDIV = this.createNodeDom(this.root);
                this.renderDom.appendChild(nodeDIV);
                this.renderNode(nodeDIV, this.root);
            }else{
               let children= this.root._children;
               children.forEach((item)=>{
                    var nodeDIV = this.createNodeDom(item);
                    this.renderDom.appendChild(nodeDIV);
                    this.renderNode(nodeDIV, item);
               });
            }
        } else {
            //no match node
            if (this._noMatchDom == undefined && this.config.noMatchDom) {
                var noMatchDom = this.config.noMatchDom;
                if (noMatchDom instanceof HTMLElement) {
                    this._noMatchDom = noMatchDom.outerHTML;
                } else {
                    this._noMatchDom = noMatchDom;
                }
            }
            this.renderDom.innerHTML = "" || this._noMatchDom;
        }
    }
    _loadLevel: number = 0;
    static LOAD_MAXLEVEL = 3;
    /**
     * 原始选中的Dom
     */
    selectedNode: HTMLElement;
    /**
     * 渲染节点到dom 中
     * @param dom 
     * @param node 
     */
    renderNode(dom: HTMLElement | DocumentFragment, node: TreeNodeData) {
        var closed = node.close == undefined || node.close == true;
        const child = node._children;
        var span = createEl('span', { class: 'treeEmpatySpan' }, child && child.length > 0 ? {
            class: closed ? 'tree_close_icon' : 'tree_open_icon',
            event: {
                click: () => {
                    $(span).parent().find(">div.childrenDIV >div.loadMore:first").click();
                    if ($(span).hasClass('tree_close_icon')) {
                        $(span).removeClass('tree_close_icon').addClass('tree_open_icon');
                        $(childNode).css('display', 'block');
                        node.close = false;
                    } else {
                        $(span).addClass('tree_close_icon').removeClass('tree_open_icon');
                        $(childNode).css('display', 'none');
                        node.close = true;
                    }
                }
            }
        } : '');
        var icon = this.nodeIcon? createEl('i', { class: 'iconeasytrack objectImgIcon icon_' + this.nodeIcon }):'';
        var textNode = createEl('span', {
            id: "nodeID" + node.id,
            value: node.id,
            parentID: node.parentId,
            node: node,
            style: { 'cursor': 'pointer' }
        }, node.name);
        if (this.config.renderNodeTemplate) {
            this.config.renderNodeTemplate(textNode, node);
        }
        if (this.config.selectedNodeID == node.id) {
            this.selectedNode = textNode;
            if (this.config.selectedNodeClass) {
                $(textNode).addClass(this.config.selectedNodeClass);
            }
            if (this.config.selectedNodeStyle) {
                $(textNode).css(this.config.selectedNodeStyle);
            }
        }
        if (this.config.onNodeSelect) {
            $(textNode).on('click', (event: Event) => {
                if (this.config.selectedNodeClass) {
                    $(textNode).addClass(this.config.selectedNodeClass);
                }
                if (this.config.selectedNodeStyle) {
                    $(textNode).css(this.config.selectedNodeStyle);
                }
                this.config.selectedNodeID = node.id;
                const oldSelectedDom = this.selectedNode;
                this.config.onNodeSelect(event, node, textNode, this.selectedNode);
                this.selectedNode = textNode;
                if (this.config.selectedNodeClass) {
                    $(oldSelectedDom).removeClass(this.config.selectedNodeClass);
                }
            })
        }

        var childNode = createEl('div', {
            id: "subContainer_nodeID" + node.id,
            class:'childrenDIV',
            style: {
                marginLeft: '16px',
                display: closed ? 'none' : 'block'
            }
        });

        createEl(dom, span, icon, textNode, childNode);
        const tree = this;
        if (child && child.length > 0) {
            if (node._loadMoreDom == undefined&&this.filterNodeSize>2000) {
                this.createMore( node, childNode);
            }
            this.renderChild(node, childNode);
        }
        return dom;
    }
    renderChild(node: TreeNodeData, dom: HTMLElement | DocumentFragment) {
        this._loadLevel++;
        const child = node._children;
        const tree = this;
        if (child) {
            if (node.loadsize == undefined) {
                node.loadsize = 0;
            }
            if(this._loadLevel>Tree.LOAD_MAXLEVEL&&this.filterNodeSize>2000){
                if (node._loadMoreDom == undefined) {
                    this.createMore( node, dom);
                }
            }else{
                const startIndex = node.loadsize;
                let firstEndSize = Math.min(child.length, node.loadsize + tree.loadchildSize);
                if(this.filterNodeSize<2000){
                    firstEndSize=child.length;
                }
                for (var i = startIndex, j = firstEndSize; i < j; i++) {
                    var subNode = this.createNodeDom(child[i]);
                    this.renderNode(subNode, child[i]);
                    node._loadedChild = true;
                    dom.appendChild(subNode);
                    node.loadsize=firstEndSize;
                }
                if (node._loadMoreDom == undefined&&this.filterNodeSize>2000) {
                    this.createMore( node, dom);
                }else if(node._loadMoreDom){
                    dom.appendChild(node._loadMoreDom)
                }
            }
            
        }
    }

    private createMore( node: TreeNodeData, dom: HTMLElement | DocumentFragment) {
        const tree=this;
        const child=node._children;
        var loadMoreDiv = createEl('div', {
            class: 'loadMore',
            event: {
                click: (event: Event) => {
                    const frag = document.createDocumentFragment();
                    var startSize = loadMoreDiv.parentElement.children.length - 1;
                    const endSize = Math.min(child.length, startSize + tree.loadchildSize);
                    for (let x = startSize, y = endSize; x < y; x++) {
                        var div = this.createNodeDom(child[x]);
                        frag.appendChild(div);
                        tree.renderNode(div, child[x]);
                    }
                    const el = event.target as HTMLElement;
                    if (endSize >= child.length) {
                        el.parentElement.removeChild(el);
                        node._loadMoreDom = undefined;
                        if(this.__observer){
                            this.__observer.unobserve(el);
                        }
                    } else {
                        frag.appendChild(el);
                    }
                    dom.appendChild(frag);

                }
            }
        }, '加载更多');
        dom.appendChild(loadMoreDiv);
        node._loadMoreDom = loadMoreDiv;
        if(this.__observer){
            this.__observer.observe(loadMoreDiv);
        }
       
    }
}
if((window as any).ET==undefined){
    (window as any).ET={
    };
}
(window as any).ET.Tree=Tree;