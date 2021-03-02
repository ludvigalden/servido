import { clearServiceDependent, forgoService } from "./forgo-service";
import { requireService } from "./require-service";
import { Service } from "./service";
import { useAgent } from "./service-agent";
import { ServiceContext } from "./service-context";
import { ServiceContextProvider } from "./service-context-provider";
import { deleteData, hydrateData, resolveData, setData } from "./service-data-util";
import { useConstructing, useService } from "./service-hooks";
import { ServiceProvider } from "./service-provider";
import {
    asyncServiceQuery,
    configure,
    contextOf,
    executionOf,
    handle,
    handleSync,
    hasInstance,
    identifierFor,
    identifierOf,
    isConstructing,
    isDeconstructed,
    paramsOf,
    serviceQuery,
    useDependent,
    useExecutionResolver,
    useHandler,
    useParams,
    useResolver,
} from "./service-util";

class servido {
    Service: typeof Service = Service;
    Provider: typeof ServiceProvider = ServiceProvider;
    Context: typeof ServiceContext = ServiceContext;
    ContextProvider: typeof ServiceContextProvider = ServiceContextProvider;
    use: typeof useService = useService;
    require: typeof requireService = requireService;
    forgo: typeof forgoService = forgoService;
    clearDependent: typeof clearServiceDependent = clearServiceDependent;
    useContext: typeof ServiceContext.use = ServiceContext.use.bind(ServiceContext);
    resolve: typeof Service.resolve = Service.resolve;
    /** Generate a `ServiceIdentifier` for a set of passed arguments. */
    identifier: typeof Service.identifier = Service.identifier;
    isConstructing: typeof isConstructing = isConstructing;
    isDeconstructed: typeof isDeconstructed = isDeconstructed;
    useConstructing: typeof useConstructing = useConstructing;
    useAgent: typeof useAgent = useAgent;
    useDependent: typeof useDependent = useDependent;
    useResolver: typeof useResolver = useResolver;
    useExecutionResolver: typeof useExecutionResolver = useExecutionResolver;
    useHandler: typeof useHandler = useHandler;
    useParams: typeof useParams = useParams;
    identifierOf: typeof identifierOf = identifierOf;
    identifierFor: typeof identifierFor = identifierFor;
    contextOf: typeof contextOf = contextOf;
    paramsOf: typeof paramsOf = paramsOf;
    configure: typeof configure = configure;
    hasInstance: typeof hasInstance = hasInstance;
    executionOf: typeof executionOf = executionOf;
    handle: typeof handle = handle;
    handleSync: typeof handleSync = handleSync;
    hydrateData: typeof hydrateData = hydrateData;
    deleteData: typeof deleteData = deleteData;
    setData: typeof setData = setData;
    resolveData: typeof resolveData = resolveData;
    query: typeof serviceQuery = serviceQuery;
    asyncQuery: typeof asyncServiceQuery = asyncServiceQuery;
}

const s = new servido();
export default s;
