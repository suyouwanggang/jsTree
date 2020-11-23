if(window.Map==undefined){
    class Map{
       keys = new Array();
       data = new Object();
   
       set (key:any, value:any) {
           if ((this.data as any)[key] == null) {
               if (this.keys.indexOf(key) == -1) {
                   this.keys.push(key);
               }
           }
           (this.data as any)[key] = value;
       }
   
       get (key:any) {
           return (this.data as any)[key];
       }
   }
   class Set{
       items = {};
       add(value:any){
           if(!this.has(value)){
               return false
           }
           (this.items as any)[value]=value;
           return true;
       }
       remove (value:any) {
           if(!this.has(value)){
               return false
           }
           delete (this.items as any)[value]
           return true;
       }
       has (key:any) {
           return this.items.hasOwnProperty(key);
       }
   }
   (window as any).Map=Map;
   (window as any).Set=Set;
  
}
