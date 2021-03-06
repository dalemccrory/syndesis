import {
  API_PROVIDER_END_ACTION_ID,
  getActionById,
  getConnectionConnector,
  getConnectorActions,
  WEBHOOK_INCOMING_ACTION_ID,
  WithActionDescriptor,
} from '@syndesis/api';
import * as H from '@syndesis/history';
import {
  Action,
  ErrorKey,
  IConfigurationProperties,
  IConfigurationProperty,
  IConnectionOverview,
} from '@syndesis/models';
import { PageLoader, PageSection } from '@syndesis/ui';
import { WithLoader } from '@syndesis/utils';
import * as React from 'react';
import resolvers from '../../../../connections/resolvers';
import { ActionDescriptorFetchError } from './ActionDescriptorFetchError';
import { ConfigurationForm } from './ConfigurationForm';
import { NothingToConfigure } from './NothingToConfigure';

export interface IOnUpdatedIntegrationProps {
  /**
   * the action object that has been configured.
   */
  action: Action;
  /**
   * true if the configuration is not complete because there are other steps,
   * false otherwise.
   * If true the form should be re-rendered with an incremented
   * [configurationPage]{@link IWithConfigurationFormProps#configurationPage}.
   */
  moreConfigurationSteps: boolean;
  /**
   * the configured values.
   */
  values: { [key: string]: string } | null;
}

export interface IWithConfigurationFormProps {
  /**
   * the connection object that contains the action with the provided
   * [actionId]{@link IWithConfigurationFormProps#actionId}. Used to retrieve
   * the form definition.
   */
  connection: IConnectionOverview;
  /**
   * the ID of the action that needs to be configured.
   */
  actionId: string;

  /**
   * the action configuration that had been previously configured on the step
   */
  oldAction?: Action;
  /**
   * a list of possible error keys for steps that need to worry about error handling
   */
  errorKeys?: ErrorKey[];
  /**
   * for actions whose configuration must be performed in multiple steps,
   * indicates the current step.
   */
  configurationPage: number;
  /**
   * the values to assign to the form once rendered. These can come either from
   * an existing integration or from the [onUpdatedIntegration]{@link IWithConfigurationFormProps#onUpdatedIntegration}
   * callback.
   */
  initialValue?: { [key: string]: string };

  /**
   * Boolean value that determines whether or not the Back button is allowed on the
   * configuration form.
   */
  isBackAllowed: boolean;

  chooseActionHref: H.LocationDescriptor;

  /**
   * the callback that is fired after the form submit with valid values.
   *
   * @see [action]{@link IOnUpdatedIntegrationProps#action}
   * @see [moreConfigurationSteps]{@link IOnUpdatedIntegrationProps#moreConfigurationSteps}
   * @see [values]{@link IOnUpdatedIntegrationProps#values}
   */
  onUpdatedIntegration(props: IOnUpdatedIntegrationProps): Promise<void>;
}

/**
 * A really specific helper function to apply collected error keys to
 * an error mapping form
 * @param definition
 * @param errorKeys
 */
function applyErrorKeysToForm(
  definition: IConfigurationProperties,
  errorKeys: ErrorKey[]
) {
  const errorResponseCodes = definition.errorResponseCodes as IConfigurationProperty;
  // TODO compatibility, remove when this property is defined
  if (!errorResponseCodes) {
    return definition;
  }
  const extProperties =
    typeof errorResponseCodes.extendedProperties === 'string'
      ? JSON.parse(errorResponseCodes.extendedProperties)
      : {};
  const newExtendedProperties = JSON.stringify({
    ...extProperties,
    mapsetKeys: errorKeys,
  });
  return {
    ...definition,
    errorResponseCodes: {
      ...errorResponseCodes,
      extendedProperties: newExtendedProperties,
    },
  } as IConfigurationProperties;
}

/**
 * A component to generate a configuration form for a given action and values.
 *
 * @see [action]{@link IWithConfigurationFormProps#action}
 * @see [moreConfigurationSteps]{@link IWithConfigurationFormProps#moreConfigurationSteps}
 * @see [values]{@link IWithConfigurationFormProps#values}
 */
export const WithConfigurationForm: React.FunctionComponent<IWithConfigurationFormProps> = props => {
  // Use the action configuration that was set on the step, otherwise find it in the connection definition
  const action =
    props.oldAction ||
    getActionById(
      getConnectorActions(getConnectionConnector(props.connection)),
      props.actionId
    );

  const isApiProvider = props.actionId === API_PROVIDER_END_ACTION_ID;
  const isWebHook = props.actionId === WEBHOOK_INCOMING_ACTION_ID;

  // The API provider end action gets some special treatment
  if (isApiProvider) {
    return (
      <ConfigurationForm
        action={action}
        descriptor={action.descriptor!}
        definitionCustomizer={definition => {
          return applyErrorKeysToForm(definition, props.errorKeys!);
        }}
        {...props}
      >
        <NothingToConfigure
          action={action}
          descriptor={action.descriptor!}
          {...props}
        />
      </ConfigurationForm>
    );
  }

  // For all other actions, the descriptor is fetched from the meta service
  return (
    <WithActionDescriptor
      connectionId={props.connection.id!}
      actionId={action.id!}
      initialValue={action.descriptor}
      configuredProperties={props.initialValue || {}}
    >
      {({ data, error, errorMessage, loading }) => {
        return (
          <WithLoader
            error={error}
            loading={loading}
            loaderChildren={<PageLoader />}
            errorChildren={
              <PageSection>
                <ActionDescriptorFetchError
                  connectionDetailHref={resolvers.connection.details({
                    connection: props.connection,
                  })}
                  error={errorMessage!}
                />
              </PageSection>
            }
          >
            {() => (
              <ConfigurationForm
                action={action}
                definitionCustomizer={definition => {
                  return isWebHook
                    ? applyErrorKeysToForm(definition, props.errorKeys!)
                    : definition;
                }}
                descriptor={data}
                {...props}
              >
                <NothingToConfigure
                  action={action}
                  descriptor={data}
                  {...props}
                />
              </ConfigurationForm>
            )}
          </WithLoader>
        );
      }}
    </WithActionDescriptor>
  );
};
