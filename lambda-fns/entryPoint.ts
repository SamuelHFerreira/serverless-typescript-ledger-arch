exports.handler = async function(booleanOrder:any) {
    console.log("Requested Lambda Handler :", JSON.stringify(booleanOrder, undefined, 2));
    
    let inversedInput = booleanOrder!;
    
    return {'containsFailure': inversedInput}
}