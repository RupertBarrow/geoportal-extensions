import L from "leaflet";
import Logger from "../../Common/Utils/LoggerByDefault";
import LayerConfig from "./LayerConfig";
import Config from "../../Common/Utils/Config";
import WMS from "./WMS";
import WMTS from "./WMTS";

var logger = Logger.getLogger("layers");

/**
 * Geoportal Layers Factory to be used together with Leaflet Maps.
 *
 * @module Layers
 * @alias L.geoportalLayer
 * @example
 * var map = L.Map(...) ;
 * var layer = L.geoportalLayer.WMTS({
 *      layer : "ORTHOIMAGERY.ORTHOPHOTOS",
 * }).addTo(map) ;
 */
/** @type {L.geoportalLayer} */
var Layers = {

    options : {},
    params : {},
    protocol : null,

    serviceUrl : "http://localhost?no-rights-found-for=[{layer}]",

    /**
     * initialize options
     */
    _initOptions : function () {
        if (!this.options || Object.keys(this.options).length === 0) {
            throw new Error("PARAM_MISSING : options !");
        }

        if (!this.options.layer) {
            throw new Error("PARAM_MISSING : layer !");
        }

        // FIXME est ce utile de le preciser ?
        if (!this.options.apiKey) {
            logger.log("PARAM_MISSING : apiKey !");
        }

        // par defaut
        if (typeof this.options.ssl === "undefined") {
            this.options.ssl = true;
        }
    },

    /**
     * get runtime context
     */
    _initContext : function () {
        // si ssl = false on fait du http
        // par défaut, ssl = true, on fait du https
        this.protocol = this.options.ssl === false ? "http://" : "https://";
    },

    /**
     * initialize parameters
     *
     * @param {String} service - service name, WMS or WMTS
     */
    _initParams : function (service) {
        // par defaut...
        if (!service) {
            service = "WMTS";
        }

        // Récupération de la configuration
        this.params = LayerConfig.get({
            key : this.options.apiKey,
            layer : this.options.layer,
            service : service
        });

        if (!this.params || Object.keys(this.params).length === 0) {
            this.params = {};
            if (!this.options.apiKey) {
                // FIXME on retire l'exception...
                logger.log("WARNING PARAM_MISSING : parameter 'apiKey' is mandatory if the contract key configuration has not been loaded !");
            }
        }
    },

    /**
     * Factory function for Geoportal or INSPIRE WMS Layers creation.
     *
     * @method WMS
     * @static
     * @alias L.geoportalLayer.WMS
     * @extends {L.TileLayer.WMS}
     *
     * @param {Object} options - options for function call.
     * @param {String} options.layer - layer name (e.g. "ORTHOIMAGERY.ORTHOPHOTOS")
     * @param {Boolean} [options.ssl] - if set true, enforce protocol https (only for nodejs)
     * @param {String} [options.apiKey] - access key to Geoportal platform, obtained [here]{@link https://geoservices.ign.fr/services-web}.
     * @param {Object} [settings] - other options for L.TileLayer.WMS function (see {@link http://leafletjs.com/reference.html#tilelayer-wms-options})
     * @param {Array} [settings.legends]   - Overloads the default legends objects associated to the layer
     * @param {Array} [settings.metadata]   - Overloads the default Metadata objects associated to the layer
     * @param {String} [settings.title]   - Overloads the default title of the layer
     * @param {String} [settings.description]   - Overloads the default description of the layer
     * @param {String} [settings.quicklookUrl]   - Overloads the default quicklookUrl of the layer
     *
     * @returns {L.geoportalLayer.WMS} WMS layer
     *
     * @example
     *  var map = L.Map('divmap').setView();
     *  var lyr = L.geoportalLayer.WMS(
     *    {
     *      layer : "OI.OrthoimageCoverage"
     *    },
     *    {
     *      opacity : 1,
     *      transparent : true,
     *      minZoom : 1,
     *      maxZoom : 21
     *      ...
     *    });
     *
     *  lyr.addTo(map); // ou map.addLayer(lyr);
     */
    WMS : function (options, settings) {
        // gestion du logger
        var logger = Logger.getLogger("layers-wms");

        /** options du plugins */
        this.options = options || {};

        // gestion des options
        this._initOptions();

        /** options natives de Leaflet */
        this.settings = settings || {};

        // env d'execution : browser ou non ?
        this._initContext();

        // Récupération de la configuration
        this._initParams("WMS");
        logger.log(this.params);

        // url du service
        var serviceUrl = null;

        if (this.params.url) {
            // sinon on prend la première clé disponible pour la couche dans la Config
            serviceUrl = this.params.url;
        } else if (this.options.apiKey) {
            // une apiKey est fournie sans URL récupérée :
            // on tente le chemin privé du service WMS raster
            serviceUrl = "https://data.geopf.fr/private/wms-r";
        } else {
            // pas de Config, ni de clef API !
            // on construit le chemin public du service WMS raster
            serviceUrl = "https://data.geopf.fr/wms-r";
        }

        // params du service WMS (par defaut)
        var paramsWms = {
            layers : this.options.layer,
            styles : this.params.styles || "normal",
            format : this.params.format || "image/jpeg",
            version : this.params.version || "1.3.0"
        };

        if (serviceUrl.includes("/private/")) {
            var apiKey = this.options.apiKey || Config.configuration.getLayerKey(Config.configuration.getLayerId(paramsWms.layers, "WMS"))[0];
        }

        // options natives de leaflet (par defaut)
        var paramsNative = {
            // zoom level
            minZoom : this.params.minZoom || 1,
            maxZoom : this.params.maxZoom || 21
        };

        // merge des options utilisateur pour le service WMS
        L.Util.extend(paramsWms, this.settings);
        // merge des options utilisateur aux options natives de leaflet
        L.Util.extend(paramsNative, this.settings);

        return new WMS(
            serviceUrl.replace(/(http|https):\/\//, this.protocol), {
                paramsNative : paramsNative,
                paramsWms : paramsWms,
                apikey : apiKey,
                originators : this.params.originators || this.settings.originators || [],
                legends : this.settings.originators || this.params.legends || [],
                metadata : this.settings.metadata || this.params.metadata || [],
                title : this.settings.title || this.params.title || "",
                description : this.settings.description || this.params.description || "",
                quicklookUrl : this.settings.quicklookUrl || this.params.quicklookUrl || ""
            }
        );
    },

    /**
     * Factory function for Geoportal WMTS Layers creation.
     *
     * @method WMTS
     * @static
     * @alias L.geoportalLayer.WMTS
     * @extends {L.TileLayer}
     *
     * @param {Object} options - options for function call.
     * @param {String} options.layer - layer name (e.g. "ORTHOIMAGERY.ORTHOPHOTOS")
     * @param {Boolean} [options.ssl] - if set true, enforce protocol https (only for nodejs)
     * @param {String} [options.apiKey] - free access key to Geoportal platform, obtained [here]{@link https://geoservices.ign.fr/services-web}.
     * @param {Object} [settings] - other options for L.TileLayer function (see {@link http://leafletjs.com/reference.html#tilelayer-options})
     *
     * @returns {L.geoportalLayer.WMTS} WMTS layer
     *
     * @example
     *  var map = L.Map('divmap').setView();
     *  var lyr = L.geoportalLayer.WMTS(
     *    {
     *      layer : "ORTHOIMAGERY.ORTHOPHOTOS"
     *    },
     *    {
     *      opacity : 1,
     *      transparent : true,
     *      minZoom : 1,
     *      maxZoom : 21
     *      ...
     *    });
     *
     *  lyr.addTo(map); // ou map.addLayer(lyr);
     */
    WMTS : function (options, settings) {
        // gestion du logger
        var logger = Logger.getLogger("layers-wmts");

        /** options du plugins */
        this.options = options || {};

        // gestion des options
        this._initOptions();

        /** options natives de Leaflet */
        this.settings = settings || {};

        // env d'execution : browser ou non ?
        this._initContext();

        // Récupération de la configuration
        this._initParams("WMTS");
        logger.log(this.params);

        // url du service
        var serviceUrl = null;

        if (this.params.url) {
            // sinon on prend la première clé disponible pour la couche dans la Config
            serviceUrl = this.params.url;
        } else if (this.options.apiKey) {
            // une apiKey est fournie sans URL récupérée :
            // on tente le chemin privé du service WMTS
            serviceUrl = "https://data.geopf.fr/private/wmts";
        } else {
            // pas de Config, ni de clef API !
            // on construit le chemin public du service
            serviceUrl = "https://data.geopf.fr/wmts";
        }

        // params du service WMTS (par defaut)
        var paramsWmts = {
            layer : this.options.layer,
            style : this.params.styles || "normal",
            format : this.params.format || "image/jpeg",
            version : this.params.version || "1.0.0",
            tilematrixset : this.params.TMSLink || "PM"
        };

        if (serviceUrl.includes("/private/")) {
            var apiKey = this.options.apiKey || Config.configuration.getLayerKey(Config.configuration.getLayerId(paramsWmts.layer, "WMTS"))[0];
        }

        // options natives de leaflet (par defaut)
        //    minZoom : 0
        //    maxZoom : 18
        //    tileSize : 256
        //    subdomains : 'abc'
        //    errorTileUrl : ''
        //    attribution : ''
        //    zoomOffset : 0
        //    opacity : 1

        var paramsNative = {
            // zoom level
            minZoom : this.params.minZoom || 1,
            maxZoom : this.params.maxZoom || 21
        };

        // merge des options utilisateur pour le service WMTS
        L.Util.extend(paramsWmts, this.settings);
        // merge des options utilisateur aux options natives de leaflet
        L.Util.extend(paramsNative, this.settings);

        return new WMTS(
            serviceUrl.replace(/(http|https):\/\//, this.protocol), {
                paramsNative : paramsNative,
                paramsWmts : paramsWmts,
                apikey : apiKey,
                originators : this.params.originators || this.settings.originators || [],
                legends : this.settings.originators || this.params.legends || [],
                metadata : this.settings.metadata || this.params.metadata || [],
                title : this.settings.title || this.params.title || "",
                description : this.settings.description || this.params.description || "",
                quicklookUrl : this.settings.quicklookUrl || this.params.quicklookUrl || ""
            }
        );
    }
};

export default Layers;
