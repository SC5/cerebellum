module.exports = function validateOptions(options) {
  if (!options.storeId || typeof options.storeId !== "string") {
    throw new Error("You must define storeId option, it's used for collections cache, e.g. 'store'");
  }

  if (!options.render || typeof options.render !== "function") {
    throw new Error("You must define render option, it will be called when route handler finishes.");
  }

  if (!options.routes || typeof options.routes !== "object") {
    throw new Error("You must define routes option or your app won't respond to anything");
  }

  if (!options.stores || typeof options.stores !== "object") {
    console.warn("You won't be able to use this.store in router without defining any stores");
  }
};