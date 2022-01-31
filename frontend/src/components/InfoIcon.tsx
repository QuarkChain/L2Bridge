import React from "react";
import { library, IconName, IconProp } from "@fortawesome/fontawesome-svg-core";
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon, FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import ReactTooltip from 'react-tooltip';
import { COLOR } from 'consts'
library.add(
    faQuestionCircle
);

const getIcon = (name: IconName): IconProp => {
    if (name === "question-circle") {
        return ["far", "question-circle"];
    }
    else {
        return name;
    }
};

type IconProps = Pick<FontAwesomeIconProps, "style" | "size" | "color" | "spin"> & {
    name: IconName;
};

const Icon: React.FC<IconProps> = ({ name, style, ...rest }) => (
    <FontAwesomeIcon style={style} icon={getIcon(name)} {...rest} />
);

export type InfoIconProps = Pick<FontAwesomeIconProps, "size">


const InfoIcon: React.FC<InfoIconProps> = ({ size = "xs" }) => {
    return (
            <span data-tip="fee = max($1, amount * 0.05%)">
                &nbsp;
                <Icon name="question-circle" size={size} style={{ 'color': COLOR.text }} />
                <ReactTooltip place="right" type="dark" effect="solid" />
            </span>
    );
};

export default InfoIcon;