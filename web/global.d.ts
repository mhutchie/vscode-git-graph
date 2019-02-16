import {
    GitCommandStatus as GitCommandStatusX,
    GitCommitDetails as GitCommitDetailsX,
    GitCommitNode as GitCommitNodeX,
    GitFileChange as GitFileChangeX,
    GitGraphViewSettings as GitGraphViewSettingsX,
    GitResetMode as GitResetModeX,
    RequestMessage as RequestMessageX,
    ResponseMessage as ResponseMessageX
} from "../out/types";

declare global {
    type GitCommandStatus = GitCommandStatusX;
    type GitCommitDetails = GitCommitDetailsX;
    type GitCommitNode = GitCommitNodeX;
    type GitFileChange = GitFileChangeX;
    type GitGraphViewSettings = GitGraphViewSettingsX;
    type GitResetMode = GitResetModeX;
    type RequestMessage = RequestMessageX;
    type ResponseMessage = ResponseMessageX;
}