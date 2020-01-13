import React, {CSSProperties, FormEvent, useState} from 'react';
import {IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar} from '@ionic/react';

import {useTranslation} from 'react-i18next';

import styles from './CreateTaskModal.module.scss';

import {contrast} from '../../../utils/utils.color';

import {rootConnector, RootProps} from '../../../store/thunks/index.thunks';

import {Project} from '../../../models/project';

import {ThemeService} from '../../../services/theme/theme.service';


interface Props extends RootProps {
    closeAction: Function;
}

const CreateTaskModal: React.FC<Props> = (props: Props) => {

    const {t} = useTranslation(['tasks', 'common']);

    const [project, setProject] = useState<Project | undefined>(undefined);

    async function handleSubmit($event: FormEvent<HTMLFormElement>) {
        $event.preventDefault();
    }

    return renderContent();

    function renderContent() {

        const color: string | undefined = project && project.data && project.data.client ? project.data.client.color : undefined;
        const colorContrast: string = contrast(color, 128, ThemeService.getInstance().isDark());

        return <IonContent>
            <IonHeader>
                <IonToolbar style={{'--background': color, '--color': colorContrast, '--ion-toolbar-color': colorContrast} as CSSProperties}>
                    <IonTitle>{t('tasks:create.title')}</IonTitle>
                    <IonButtons slot="start">
                        <IonButton onClick={() => props.closeAction()}>
                            <IonIcon name="close" slot="icon-only"></IonIcon>
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <main className="ion-padding">
                <form onSubmit={($event: FormEvent<HTMLFormElement>) => handleSubmit($event)}>
                </form>
            </main>
        </IonContent>
    }

};

export default rootConnector(CreateTaskModal);
