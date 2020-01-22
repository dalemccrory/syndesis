/*
 * Copyright (C) 2019 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package backup

import (
	"errors"

	"github.com/operator-framework/operator-sdk/pkg/log/zap"
	"github.com/operator-framework/operator-sdk/pkg/restmapper"
	"github.com/spf13/cobra"
	"github.com/syndesisio/syndesis/install/operator/pkg/apis"
	"github.com/syndesisio/syndesis/install/operator/pkg/apis/syndesis/v1beta1"
	"github.com/syndesisio/syndesis/install/operator/pkg/cmd/internal"
	"github.com/syndesisio/syndesis/install/operator/pkg/syndesis/backup"
	"github.com/syndesisio/syndesis/install/operator/pkg/syndesis/configuration"
	"github.com/syndesisio/syndesis/install/operator/pkg/util"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/manager"
)

type Backup struct {
	*internal.Options
	backupDir string
}

func NewBackup(parent *internal.Options) *cobra.Command {
	o := Backup{Options: parent}
	cmd := cobra.Command{
		Use:   "backup",
		Short: "backup the data for the syndesis install",
		Run: func(_ *cobra.Command, _ []string) {
			util.ExitOnError(o.Run())
		},
	}
	cmd.PersistentFlags().StringVarP(&configuration.TemplateConfig, "operator-config", "", "/conf/config.yaml", "Path to the operator configuration file.")
	cmd.Flags().StringVar(&o.backupDir, "backup", "backup", "The directory to store the back up in")
	cmd.PersistentFlags().AddFlagSet(zap.FlagSet())
	cmd.PersistentFlags().AddFlagSet(util.FlagSet)
	return &cmd
}

func (o *Backup) prepare() (*v1beta1.Syndesis, client.Client, error) {
	mgr, err := manager.New(o.GetClientConfig(), manager.Options{
		Namespace:      o.Namespace,
		MapperProvider: restmapper.NewDynamicRESTMapper,
	})
	if err != nil {
		return nil, nil, err
	}

	if err := apis.AddToScheme(mgr.GetScheme()); err != nil {
		return nil, nil, err
	}

	cl, err := o.GetClient()
	if err != nil {
		return nil, nil, err
	}

	syndesis, err := v1beta1.InstalledSyndesis(o.Context, cl, o.Namespace)
	if err != nil {
		return nil, cl, err
	}

	if syndesis == nil {
		return nil, cl, errors.New("No syndesis has been installed to backup its database")
	}

	return syndesis, cl, nil
}

func (o *Backup) Run() error {
	syndesis, cl, err := o.prepare()
	if err != nil {
		return err
	}

	b, err := backup.NewBackup(o.Context, cl, syndesis, o.backupDir)
	if err != nil {
		return err
	}

	// Only backup to local location
	b.SetLocalOnly(true)

	return b.Run()
}
