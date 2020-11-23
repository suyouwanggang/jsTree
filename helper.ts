import $ from 'jquery';
export const createEl = (tag: string | HTMLElement|DocumentFragment, ...child: unknown[]) => { 
    let el: HTMLElement;
    if (tag instanceof HTMLElement || tag instanceof DocumentFragment) {
        el = <HTMLElement>tag;
    } else { 
        el= document.createElement(tag);
    }
    
    child.forEach((item: unknown) => { 
         if (item instanceof HTMLElement) {
            el.appendChild(item);
         }else if (Array.isArray(item)) { 
            item.forEach((itemNode: unknown)=>{ 
                createEl(el, itemNode);
            })
        } else if (typeof item == 'object') { 
             for (let key in item) { 
                 if (key == 'style') {
                     setStyle(el, (item as any)[key] );
                 } else if (key == 'event') {
                     setEvent(el, (item as any)[key]);
                 } else if (key == 'class') {
                    setClassList(el, (item as any)[key]);
                } else if (key == 'prop') {
                     setAttribute(el, (item as any)[key]);
                 } else { 
                     (el as any)[key] = (item as any)[key];
                 }
             }
        }  else { 
           var text= document.createTextNode(item as string);
           el.appendChild(text);
        }

    })
    return el;

}
export const setClassList = (el: HTMLElement, classObj: string|string[]) => { 
       $(el).addClass(classObj);
}
export const setStyle = (el: HTMLElement, styleObj: any) => { 
    $(el).css(styleObj);
}
export const setAttribute= (el: HTMLElement, attributeObj: any) => { 
    if (typeof attributeObj == 'object') {
        for (let key in attributeObj) {
            el.setAttribute(key, (attributeObj[key] as string));
        }
    } 
}
/**
 * @returns 返回一个对象，可以删除监听
 * @param el DOM对象
 * @param event 事件类型
 * @param listener 监听
 * @param options 事件监听options
 */
export const addEvent = (el: HTMLDocument| Element | SVGAElement, event: string, listener: EventListener, options?: boolean | AddEventListenerOptions) => {
    el.addEventListener(event, listener, options);
    return {
        destory: () => {
            el.removeEventListener(event, listener, options);
        }
    };
};
export type ListenerResult = {
    destory: () => void;
};
export const setEvent= (el: HTMLElement, eventObj: any) => { 
    const result:ListenerResult[]=[];
    if (typeof eventObj == 'object') {
        for (let key in eventObj) {
            const fun = (event: Event) => {
                (eventObj[key] as any).call(el, event);
            };
           result.push(addEvent(el,key,fun));
        }
    } 
    return result;
}