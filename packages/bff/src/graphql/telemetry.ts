import type {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { SpanStatusCode, trace } from '@opentelemetry/api';

function setGraphqlSpanName(operationType?: string, operationName?: string | null) {
  const span = trace.getActiveSpan();
  if (!span) {
    return;
  }

  if (operationType && operationName) {
    span.updateName(`graphql.${operationType} ${operationName}`);
    return;
  }

  if (operationType) {
    span.updateName(`graphql.${operationType}`);
  }
}

function setSpanAttributes(operationType?: string, operationName?: string | null) {
  const span = trace.getActiveSpan();
  if (!span) {
    return;
  }

  if (operationType) {
    span.setAttribute('graphql.operation.type', operationType);
  }

  span.setAttribute('graphql.operation.anonymous', !operationName);

  if (operationName) {
    span.setAttribute('graphql.operation.name', operationName);
  }
}

function setErrorAttributes(errorCount: number) {
  const span = trace.getActiveSpan();
  if (!span) {
    return;
  }

  span.setAttribute('graphql.errors.count', errorCount);

  if (errorCount > 0) {
    span.setStatus({ code: SpanStatusCode.ERROR });
  }
}

export function createGraphqlTelemetryPlugin(): ApolloServerPlugin<BaseContext> {
  return {
    async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
      const requestSpan = trace.getActiveSpan();

      return {
        async didResolveOperation(requestContext) {
          const operationName = requestContext.request.operationName ?? null;
          const operationType = requestContext.operation?.operation;

          requestSpan?.setAttribute('graphql.operation.anonymous', !operationName);
          if (operationName) {
            requestSpan?.setAttribute('graphql.operation.name', operationName);
          }
          if (operationType) {
            requestSpan?.setAttribute('graphql.operation.type', operationType);
          }

          setSpanAttributes(operationType, operationName);
          setGraphqlSpanName(operationType, operationName);
        },

        async didEncounterErrors(requestContext) {
          setErrorAttributes(requestContext.errors.length);
          requestSpan?.setAttribute('graphql.errors.count', requestContext.errors.length);
          if (requestContext.errors.length > 0) {
            requestSpan?.setStatus({ code: SpanStatusCode.ERROR });
          }
        },

        async willSendResponse(requestContext) {
          requestSpan?.setAttribute('graphql.errors.count', requestContext.errors?.length ?? 0);
        },
      };
    },
  };
}